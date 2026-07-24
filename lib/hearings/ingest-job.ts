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
import { transcribeYoutubeHearing } from "@/lib/hearings/youtube-transcript";
import { parseTranscriptSegments } from "@/lib/hearings/transcript-segments";
import type { TranscriptChunk } from "@/lib/hearings/transcript";

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

/* ------------------------------- Heartbeat -------------------------------- */
// El job corre fire-and-forget dentro del dev server: si el proceso muere a
// mitad de camino (reinicio, cierre de terminal), el catch nunca corre y la
// audiencia quedaria en PROCESSING para siempre sin error. El latido periodico
// permite detectar ese caso: PROCESSING sin latido fresco = job muerto.

const HEARTBEAT_INTERVAL_MS = 30_000;
/** Sin latido por este tiempo, un PROCESSING se considera trabado. */
export const INGEST_STALL_MS = 3 * 60_000;

function readMetaObject(metadata: Prisma.JsonValue | null): Prisma.JsonObject {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Prisma.JsonObject) : {};
}

/**
 * Escribe SOLO la clave del latido, con jsonb_set atomico en la base.
 *
 * Con un read-modify-write del metadata entero (leer, spread, escribir) un
 * latido en vuelo pisaba lo que acababan de guardar markHearingError o el
 * cierre de matchFullTranscript: la audiencia quedaba en ERROR pero sin el
 * campo `error`, o perdia `finalizedAt`. Es decir, el latido borraba
 * justamente el diagnostico que existe para explicar la falla.
 */
async function touchHeartbeat(meetingId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "Meeting"
      SET "metadata" = jsonb_set(
        COALESCE("metadata", '{}'::jsonb),
        '{ingestHeartbeatAt}',
        to_jsonb(${new Date().toISOString()}::text),
        true
      )
      WHERE "id" = ${meetingId}
    `;
  } catch {
    // El latido nunca debe tirar el job.
  }
}

/**
 * True si una ingesta en curso dejo de latir (job muerto). El fallback a
 * updatedAt cubre audiencias de antes del heartbeat.
 */
export function isIngestStalled(metadata: Prisma.JsonValue | null, updatedAt: Date, now = Date.now()): boolean {
  if (!readIngestSpec(metadata)) return false;
  const raw = readMetaObject(metadata).ingestHeartbeatAt;
  const beat = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  const reference = Number.isNaN(beat) ? updatedAt.getTime() : beat;
  return now - reference > INGEST_STALL_MS;
}

/**
 * Procesa una audiencia encolada: transcribe (Whisper) y machea en lote. Nunca
 * lanza: registra el error en la audiencia y no rompe el board.
 */
/**
 * Transcripcion de YouTube con oradores identificados (dos pasadas: ASR que
 * separa voces + atado de nombres probados con cita textual), convertida a los
 * tramos que consume el macheo batch. Si esa via falla (modelo caido, video
 * raro), cae a la via Whisper original: mejor una transcripcion sin oradores
 * que ninguna.
 */
async function youtubeChunksWithSpeakers(url: string): Promise<TranscriptChunk[]> {
  try {
    const result = await transcribeYoutubeHearing(url);
    const segments = parseTranscriptSegments(result.transcript);
    if (segments.length) {
      return segments.map((segment) => ({ text: segment.content, atMs: segment.startMs, speaker: segment.speakerLabel }));
    }
    // Texto sin el formato esperado: se conserva entero como un solo tramo.
    if (result.transcript.trim()) {
      return [{ text: result.transcript.trim(), atMs: 0 }];
    }
    throw new Error("La transcripcion con oradores volvio vacia");
  } catch (error) {
    console.error("Transcripcion con oradores fallo; se usa la via Whisper", error);
    return transcribeFromYoutube(url);
  }
}

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

  // Primer latido inmediato + latido periodico mientras el job vive.
  await touchHeartbeat(meetingId);
  const heartbeat = setInterval(() => {
    void touchHeartbeat(meetingId);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const chunks = spec.mode === "youtube" ? await youtubeChunksWithSpeakers(spec.url) : await transcribeFromFile(spec.filePath);
    await matchFullTranscript({
      meetingId,
      reformId: meeting.reformId,
      chunks,
      speakerLabel: spec.mode === "youtube" ? "Audiencia (YouTube)" : "Audiencia (archivo)"
    });
  } catch (error) {
    await markHearingError(meetingId, error instanceof Error ? error.message : "Error desconocido en la ingesta");
  } finally {
    clearInterval(heartbeat);
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
