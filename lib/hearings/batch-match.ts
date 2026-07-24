// Sin "server-only": lo importa el worker CLI (scripts/ingest-hearings.ts, via
// ingest-job.ts) que corre con tsx fuera de Next.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeHearingTranscript } from "@/lib/hearings/analyze";
import {
  detectMatchesAgainstNorms,
  loadFragmentKeys,
  loadNormCatalog,
  persistDetectedMatchesBatch
} from "@/lib/hearings/live-match";
import { syncRecordLifecycle } from "@/lib/hearings/record";
import { chunksToTranscript, type TranscriptChunk } from "@/lib/hearings/transcript";

/**
 * Macheo en lote de una audiencia ya ocurrida: recorre la transcripcion en
 * ventanas, cruza cada una contra las mininormas del codigo nuevo, guarda los
 * TranscriptSegment y corre el resumen estructurado. Lo comparten el camino
 * sincrono (transcripcion subida) y el worker de fondo (YouTube/audio).
 *
 * La IA orienta: los cruces son sugerencias para el equipo. La transcripcion
 * original no se altera (memoria publica).
 */

const WINDOW_CHARS = 1800;
/** Ventanas que se machean a la vez. Mismo tope que la transcripcion por tramos. */
const MATCH_PARALLEL = 4;

/** Agrupa tramos consecutivos en ventanas de ~WINDOW_CHARS, con su atMs. */
function buildWindows(chunks: TranscriptChunk[]): Array<{ text: string; atMs: number | null }> {
  const windows: Array<{ text: string; atMs: number | null }> = [];
  let current: { text: string; atMs: number | null } | null = null;

  for (const chunk of chunks) {
    const started: { text: string; atMs: number | null } = current ?? { text: "", atMs: chunk.atMs ?? null };
    started.text += `${chunk.text} `;
    if (started.text.length >= WINDOW_CHARS) {
      windows.push({ text: started.text.trim(), atMs: started.atMs });
      current = null;
    } else {
      current = started;
    }
  }

  if (current && current.text.trim().length >= 40) {
    windows.push({ text: current.text.trim(), atMs: current.atMs });
  }
  return windows;
}

function readMetadata(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Prisma.JsonObject) : {};
}

export type BatchMatchResult = { segments: number; matches: number; analyzed: boolean; warning: string | null };

export async function matchFullTranscript({
  meetingId,
  reformId,
  chunks,
  speakerLabel = "Audiencia (carga batch)",
  truncated = false
}: {
  meetingId: string;
  reformId: string;
  chunks: TranscriptChunk[];
  speakerLabel?: string;
  /** La fuente recorto la transcripcion: el acta NO cubre toda la audiencia. */
  truncated?: boolean;
}): Promise<BatchMatchResult> {
  const usable = chunks.filter((chunk) => chunk.text.trim().length > 0);
  if (!usable.length) throw new Error("La transcripcion no tiene texto para procesar");

  // 1. Guardar la transcripcion como segmentos (memoria publica, no se altera).
  // Si la fuente separo voces, cada tramo conserva su orador; si no, todos caen
  // en la etiqueta generica de la audiencia.
  //
  // En transaccion: sin ella, un fallo del createMany (timeout del pool remoto,
  // payload de miles de segmentos) dejaba la audiencia con CERO segmentos,
  // porque el deleteMany ya se habia llevado la transcripcion anterior.
  await prisma.$transaction([
    prisma.transcriptSegment.deleteMany({ where: { meetingId } }),
    prisma.transcriptSegment.createMany({
      data: usable.map((chunk) => ({
        meetingId,
        startMs: chunk.atMs ?? 0,
        endMs: chunk.atMs ?? 0,
        content: chunk.text,
        speakerLabel: chunk.speaker?.trim() || speakerLabel
      }))
    })
  ]);

  // 2. Macheo por ventanas contra el catalogo del codigo nuevo (una sola carga).
  //
  // Las ventanas son independientes entre si, asi que las llamadas al modelo
  // van de a lotes en paralelo (mismo criterio que la transcripcion por tramos).
  // Una audiencia larga da ~33 ventanas: en serie eran ~33 idas y vueltas al
  // modelo, una atras de otra. El dedupe usa un Set que vive toda la corrida en
  // vez de re-consultar los cruces en cada ventana, y las altas van por lote.
  let matches = 0;
  if (hasOpenRouterConfig()) {
    const catalog = await loadNormCatalog(reformId);
    const windows = buildWindows(usable);
    if (catalog.length && windows.length) {
      const seen = await loadFragmentKeys(meetingId);

      for (let index = 0; index < windows.length; index += MATCH_PARALLEL) {
        const batch = windows.slice(index, index + MATCH_PARALLEL);
        const detected = await Promise.all(batch.map((window) => detectMatchesAgainstNorms(catalog, window.text)));
        // La persistencia va secuencial dentro del lote: es barata y mantiene
        // el Set de dedupe coherente sin carreras entre ventanas.
        for (let position = 0; position < batch.length; position += 1) {
          matches += await persistDetectedMatchesBatch(meetingId, detected[position], batch[position].atMs, seen);
        }
      }
    }
  }

  // 3. Resumen estructurado (participantes, temas, conclusiones) + participantes.
  const transcript = chunksToTranscript(usable);
  let analyzed = false;
  let warning: string | null = null;

  if (hasOpenRouterConfig()) {
    try {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { title: true } });
      const analysis = await analyzeHearingTranscript(transcript, { title: meeting?.title });
      const draft = analysis.draft;

      const lastVersion = await prisma.meetingAnalysis.findFirst({
        where: { meetingId },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await prisma.meetingAnalysis.create({
        data: {
          meetingId,
          model: analysis.model,
          provider: analysis.provider,
          version: (lastVersion?.version ?? 0) + 1,
          summary: draft.summary,
          conclusions: [draft.conclusions] as Prisma.InputJsonValue,
          topics: [draft.mainTopic, ...draft.secondaryTopics] as Prisma.InputJsonValue,
          citations: draft.relatedArticles as Prisma.InputJsonValue
        }
      });

      if (draft.participants.length) {
        // Mismo criterio que los segmentos: reemplazo atomico, para no quedarse
        // sin participantes si falla el alta.
        await prisma.$transaction([
          prisma.meetingParticipant.deleteMany({ where: { meetingId } }),
          prisma.meetingParticipant.createMany({
            data: draft.participants.map((participant) => ({
              meetingId,
              displayName: participant.name,
              role: participant.role,
              metadata: { institution: participant.institution, actorType: participant.actorType, intervention: participant.intervention }
            }))
          })
        ]);
      }

      await prisma.meeting.update({ where: { id: meetingId }, data: { description: draft.summary } });
      analyzed = true;
    } catch (analysisError) {
      console.error("El analisis estructurado batch fallo", analysisError);
      warning = "La transcripción y los cruces quedaron guardados, pero el resumen estructurado falló.";
    }
  } else {
    warning = "La transcripción quedó guardada. El cruce con las normas y el resumen se corren cuando la IA esté configurada.";
  }

  // Un acta cortada a la mitad no puede quedar como completa sin decirlo: quien
  // la firme tiene que saber que el debate sigue mas alla del ultimo timestamp.
  const truncationNotice = truncated
    ? "La transcripción se cortó por el límite de tamaño: el acta NO cubre la audiencia completa. Revisá el final del debate en la grabación original."
    : null;
  if (truncationNotice) {
    warning = warning ? `${truncationNotice} ${warning}` : truncationNotice;
  }

  // 4. Cierre: audiencia registrada como finalizada.
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { metadata: true } });
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "READY",
      hearingStatus: "COMPLETED",
      metadata: {
        ...readMetadata(meeting?.metadata),
        finalizedAt: new Date().toISOString(),
        transcriptSegments: usable.length,
        matches,
        transcriptTruncated: truncated,
        ...(truncationNotice ? { ingestWarning: truncationNotice } : {})
      }
    }
  });
  await syncRecordLifecycle(meetingId, "COMPLETED");

  return { segments: usable.length, matches, analyzed, warning };
}

/** Marca la audiencia con el error del procesamiento sin romper el board. */
export async function markHearingError(meetingId: string, message: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { metadata: true } });
  await prisma.meeting.update({
    where: { id: meetingId },
    // Se mantiene en PROCESSING (no COMPLETED): el equipo ve que quedo pendiente.
    data: { status: "ERROR", hearingStatus: "PROCESSING", metadata: { ...readMetadata(meeting?.metadata), error: message } }
  });
}
