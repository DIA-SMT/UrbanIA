/**
 * Worker de ingesta batch de audiencias grabadas (YouTube / archivo subido).
 *
 * Procesa la cola: Meeting (kind PUBLIC_HEARING) con status PENDING/ERROR y
 * metadata.ingest (mode youtube|upload). Por cada uno corre runIngestJob, que
 * transcribe con Whisper y machea en lote contra las mininormas del codigo
 * nuevo (mismo motor que el modo en vivo), deja la audiencia COMPLETED o
 * registra el error sin romper el board.
 *
 * Uso:
 *   npm run hearings:ingest                 → procesa la cola completa
 *   npm run hearings:ingest -- --probe <url>
 *     → solo verifica que yt-dlp + ffmpeg + Whisper esten disponibles
 *
 * Corre local / en el prod-server: las funciones serverless no aguantan bajar y
 * transcribir un video de horas. Dependencias del sistema: yt-dlp (se auto-
 * descarga o YTDLP_PATH), ffmpeg (ffmpeg-static), y Whisper (OpenRouter por
 * OPENROUTER_API_KEY, o local con HEARING_WHISPER_PROVIDER=local + WHISPER_LOCAL_BIN).
 */

import { prisma } from "@/lib/db/prisma";
import { readIngestSpec, runIngestJob } from "@/lib/hearings/ingest-job";
import { transcribeFromYoutube } from "@/lib/hearings/transcribe";

function log(message: string) {
  console.log(`[ingesta] ${message}`);
}

async function probe(url: string): Promise<void> {
  const chunks = await transcribeFromYoutube(url);
  log(`Probe OK: ${chunks.length} tramos transcriptos. yt-dlp + ffmpeg + Whisper funcionan.`);
}

async function main() {
  const args = process.argv.slice(2);
  const probeIndex = args.indexOf("--probe");
  if (probeIndex !== -1) {
    const url = args[probeIndex + 1];
    if (!url) throw new Error("Uso: --probe <url de YouTube>");
    await probe(url);
    return;
  }

  const candidates = await prisma.meeting.findMany({
    where: { kind: "PUBLIC_HEARING", status: { in: ["PENDING", "ERROR"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, metadata: true }
  });
  const queue = candidates.filter((meeting) => readIngestSpec(meeting.metadata) !== null);

  if (!queue.length) {
    log("No hay audiencias en cola.");
    return;
  }

  log(`${queue.length} audiencia(s) en cola.`);
  for (const meeting of queue) {
    log(`Procesando "${meeting.title}"...`);
    await runIngestJob(meeting.id);
    const done = await prisma.meeting.findUnique({ where: { id: meeting.id }, select: { status: true, hearingStatus: true } });
    log(`"${meeting.title}": status=${done?.status} hearingStatus=${done?.hearingStatus}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
