import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import { ensureFfmpeg, run } from "@/lib/hearings/binaries";
import { downloadHearingAudioPart, hearingAudioFullPath, uploadHearingAudioFull } from "@/lib/storage/supabase";

/**
 * Une los tramos de la grabacion de una audiencia en UN MP3 y lo deja en el
 * bucket como derivado (completo.mp3). Es lo que sirve el boton "Descargar
 * audio": se genera la primera vez y despues se reusa.
 *
 * MP3 mono 64 kbps y no el webm original: el archivo es para MANDAR (WhatsApp,
 * el telefono de un concejal), y el webm no se reproduce en cualquier lado.
 * Para voz, 64k mono sobra. Una audiencia de hora y media queda en ~44 MB.
 *
 * En los bordes entre tramos quedan ~300 ms duplicados: es el solape que la
 * grabadora mete a proposito para no perder palabras. Escuchandolo no se nota
 * y preferimos esa honestidad a recortar audio de un registro publico.
 *
 * Corre en una funcion de Vercel DEDICADA (app/api/hearings/audio) que traza
 * el binario de ffmpeg-static: es la unica ruta que lo necesita y pesa ~80 MB,
 * meterlo en la ruta general de audiencias (que ya carga Chromium y onnx)
 * arriesga el limite de tamano del bundle.
 */

/** Techo de la corrida de ffmpeg. Unir+recodificar 90 min tarda ~10 s local. */
const FFMPEG_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Bitrate segun duracion, para que el archivo SIEMPRE entre en los 50 MB del
 * free tier de Supabase (tope global por archivo, no configurable). A 64 kbps
 * entran ~1 h 45 m; mas largo, se baja la calidad antes que fallar la subida.
 * Es voz: 48k se escucha bien y 32k sigue siendo perfectamente inteligible.
 */
function bitrateFor(totalSeconds: number): string {
  if (totalSeconds <= 105 * 60) return "64k"; // hasta 1 h 45 → ~50 MB max
  if (totalSeconds <= 140 * 60) return "48k"; // hasta 2 h 20
  if (totalSeconds <= 210 * 60) return "32k"; // hasta 3 h 30
  return "24k"; // hasta ~4 h 40; mas que eso no deberia existir en una audiencia
}

export type FullAudioResult = { storagePath: string; bytes: number; parts: number };

/** Genera el MP3 unido y lo sube al bucket. Null si la audiencia no tiene audio. */
export async function buildFullHearingAudio(meetingId: string): Promise<FullAudioResult | null> {
  const parts = await prisma.meetingMedia.findMany({
    where: { meetingId, kind: "AUDIO" },
    orderBy: { partIndex: "asc" },
    select: { storagePath: true, fileName: true, durationSec: true }
  });
  if (!parts.length) return null;

  const totalSeconds = parts.reduce((sum, part) => sum + (part.durationSec ?? 0), 0);
  const bitrate = bitrateFor(totalSeconds);

  const workDir = await mkdtemp(path.join(tmpdir(), "urbania-audio-full-"));
  try {
    const localFiles: string[] = [];
    for (let index = 0; index < parts.length; index += 1) {
      const bytes = await downloadHearingAudioPart(parts[index].storagePath);
      const extension = parts[index].fileName.split(".").pop() || "webm";
      const localPath = path.join(workDir, `${String(index).padStart(4, "0")}.${extension}`);
      await writeFile(localPath, bytes);
      localFiles.push(localPath);
    }

    // Lista para el demuxer concat. Barras normales: ffmpeg las acepta en
    // Windows y las backslashes rompen el escapado del formato de la lista.
    const listPath = path.join(workDir, "list.txt");
    await writeFile(listPath, localFiles.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"), "utf8");

    const outPath = path.join(workDir, "completo.mp3");
    await run(
      ensureFfmpeg(),
      ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-ac", "1", "-c:a", "libmp3lame", "-b:a", bitrate, "-y", outPath],
      FFMPEG_TIMEOUT_MS,
      "ffmpeg"
    );

    const merged = await readFile(outPath);
    if (!merged.length) throw new Error("ffmpeg no produjo salida");

    const storagePath = await uploadHearingAudioFull(meetingId, new Uint8Array(merged));
    return { storagePath: storagePath ?? hearingAudioFullPath(meetingId), bytes: merged.length, parts: parts.length };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
