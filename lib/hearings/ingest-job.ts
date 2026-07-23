// Job de ingesta batch de una audiencia grabada (YouTube o archivo subido).
// NO "server-only": lo comparten la ruta /api/hearings/ingest (fire-and-forget
// en servidores de larga vida) y el worker CLI (scripts/ingest-hearings.ts).
//
// Aviso de infraestructura: bajar y transcribir un video de 1-3 h NO entra en
// una funcion serverless (limite de tiempo + binarios). En un deploy serverless
// el fire-and-forget de la ruta se congela tras responder; por eso el worker
// (npm run hearings:ingest) en el prod-server es el camino confiable. El camino
// "subir transcripcion" (sincronico, sin binarios) funciona en cualquier lado.

import { rmSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { markHearingError, matchFullTranscript } from "@/lib/hearings/batch-match";
import { transcribeFromFile, transcribeFromYoutube } from "@/lib/hearings/transcribe";

export type IngestSpec =
  | { mode: "youtube"; url: string }
  | { mode: "upload"; filePath: string };

/** Lee la especificacion de ingesta guardada en metadata.ingest del Meeting. */
export function readIngestSpec(metadata: Prisma.JsonValue | null): IngestSpec | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const ingest = (metadata as Record<string, unknown>).ingest;
  if (!ingest || typeof ingest !== "object") return null;
  const record = ingest as Record<string, unknown>;
  if (record.mode === "youtube" && typeof record.url === "string") return { mode: "youtube", url: record.url };
  if (record.mode === "upload" && typeof record.filePath === "string") return { mode: "upload", filePath: record.filePath };
  return null;
}

/**
 * Procesa una audiencia encolada: transcribe (Whisper) y machea en lote. Nunca
 * lanza: registra el error en la audiencia y no rompe el board.
 */
export async function runIngestJob(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { reformId: true, metadata: true }
  });
  if (!meeting) return;

  const spec = readIngestSpec(meeting.metadata);
  if (!spec || !meeting.reformId) {
    await markHearingError(meetingId, "Falta la fuente de ingesta o el código nuevo asociado");
    return;
  }

  await prisma.meeting.update({ where: { id: meetingId }, data: { status: "PROCESSING" } });

  try {
    const chunks = spec.mode === "youtube" ? await transcribeFromYoutube(spec.url) : await transcribeFromFile(spec.filePath);
    await matchFullTranscript({
      meetingId,
      reformId: meeting.reformId,
      chunks,
      speakerLabel: spec.mode === "youtube" ? "Audiencia (YouTube)" : "Audiencia (archivo)"
    });
  } catch (error) {
    await markHearingError(meetingId, error instanceof Error ? error.message : "Error desconocido en la ingesta");
  } finally {
    // El audio subido es temporal: se limpia pase lo que pase.
    if (spec.mode === "upload") {
      try {
        rmSync(spec.filePath, { force: true });
      } catch {
        // Si ya no existe, nada que hacer.
      }
    }
  }
}
