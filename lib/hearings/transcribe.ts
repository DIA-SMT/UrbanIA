// Transcripcion de audio para la ingesta batch (YouTube / archivo subido).
// NO es "server-only": lo importa el worker CLI (scripts) que corre con tsx
// fuera de Next. Depende de binarios del SISTEMA (yt-dlp, ffmpeg, y opcional un
// Whisper local): son dependencias del entorno del JOB, no del build de Next.
// Documentadas en components/hearings/README.md.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { hasTranscriptionConfig, transcribeAudioFile } from "@/lib/ai/transcription";
import { parseTranscriptFile, type TranscriptChunk } from "@/lib/hearings/transcript";

const CHUNK_SECONDS = 1200; // 20 min/chunk: mp3 mono 48k ≈ 7 MB, bajo el limite de 25 MB de Whisper

/** "openrouter" (default) | "openai" usan la API; "local" un binario Whisper. */
type WhisperProvider = "openrouter" | "openai" | "local";

function whisperProvider(): WhisperProvider {
  const raw = (process.env.HEARING_WHISPER_PROVIDER || "").toLowerCase();
  if (raw === "local") return "local";
  if (raw === "openai") return "openai";
  return "openrouter";
}

/** Indica si el entorno puede transcribir audio (para degradar con aviso). */
export function hasAudioTranscription(): boolean {
  if (!ffmpegPath) return false;
  return whisperProvider() === "local" ? Boolean(process.env.WHISPER_LOCAL_BIN) : hasTranscriptionConfig();
}

/* ------------------------------- yt-dlp ----------------------------------- */

const YTDLP_RELEASES = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytdlpAssetName(): string {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return "yt-dlp_linux";
}

async function ensureYtDlp(): Promise<string> {
  const custom = process.env.YTDLP_PATH;
  if (custom && existsSync(custom)) return custom;

  const cacheDir = path.join(process.cwd(), "node_modules", ".cache", "urbania");
  const binaryPath = path.join(cacheDir, ytdlpAssetName());
  if (existsSync(binaryPath)) return binaryPath;

  mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(`${YTDLP_RELEASES}/${ytdlpAssetName()}`);
  if (!response.ok) {
    throw new Error(`No se pudo descargar yt-dlp (HTTP ${response.status}). Instalalo a mano y seteá YTDLP_PATH.`);
  }
  writeFileSync(binaryPath, Buffer.from(await response.arrayBuffer()), { mode: 0o755 });
  return binaryPath;
}

async function downloadYoutubeAudio(url: string, workDir: string): Promise<string> {
  const ytdlpPath = await ensureYtDlp();
  const result = spawnSync(
    ytdlpPath,
    ["-f", "bestaudio/best", "--no-playlist", "--no-progress", "-o", path.join(workDir, "audio-original.%(ext)s"), url],
    { stdio: ["ignore", "pipe", "pipe"], timeout: 30 * 60 * 1000 }
  );
  if (result.status !== 0) {
    const detail = `${result.stderr?.toString() ?? ""}${result.stdout?.toString() ?? ""}`.trim().slice(-400);
    throw new Error(`yt-dlp falló al descargar el audio: ${detail || "sin detalle"}`);
  }
  const downloaded = readdirSync(workDir).find((file) => file.startsWith("audio-original."));
  if (!downloaded) throw new Error("yt-dlp no dejó ningún archivo de audio");
  return path.join(workDir, downloaded);
}

/* ------------------------------- ffmpeg ----------------------------------- */

function segmentAudio(inputPath: string, workDir: string): string[] {
  if (!ffmpegPath) throw new Error("ffmpeg-static no trae binario para esta plataforma");
  const pattern = path.join(workDir, "chunk-%03d.mp3");
  const result = spawnSync(
    ffmpegPath,
    ["-hide_banner", "-loglevel", "error", "-i", inputPath, "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "segment", "-segment_time", String(CHUNK_SECONDS), pattern],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg falló: ${result.stderr?.toString().slice(-400) ?? "sin detalle"}`);
  }
  return readdirSync(workDir)
    .filter((file) => file.startsWith("chunk-") && file.endsWith(".mp3"))
    .sort()
    .map((file) => path.join(workDir, file));
}

/* ---------------------------- Whisper (chunks) ---------------------------- */

/** Whisper local (whisper.cpp / faster-whisper) que emite un .srt junto al audio. */
function transcribeChunkLocal(chunkPath: string, offsetMs: number): TranscriptChunk[] {
  const bin = process.env.WHISPER_LOCAL_BIN;
  if (!bin) throw new Error("HEARING_WHISPER_PROVIDER=local requiere WHISPER_LOCAL_BIN");

  const model = process.env.WHISPER_LOCAL_MODEL || "";
  const outDir = path.dirname(chunkPath);
  const args = ["-f", chunkPath, "-l", "es", "-osrt", "-of", chunkPath.replace(/\.mp3$/, "")];
  if (model) args.push("-m", model);

  const result = spawnSync(bin, args, { cwd: outDir, stdio: ["ignore", "pipe", "pipe"], timeout: 60 * 60 * 1000 });
  if (result.status !== 0) {
    throw new Error(`Whisper local falló: ${result.stderr?.toString().slice(-300) ?? "sin detalle"}`);
  }
  const srtPath = chunkPath.replace(/\.mp3$/, ".srt");
  if (!existsSync(srtPath)) throw new Error("Whisper local no generó el .srt esperado");

  return parseTranscriptFile(srtPath, readFileSync(srtPath, "utf8")).map((chunk) => ({
    text: chunk.text,
    atMs: offsetMs + (chunk.atMs ?? 0)
  }));
}

async function transcribeChunks(chunks: string[]): Promise<TranscriptChunk[]> {
  const provider = whisperProvider();
  const out: TranscriptChunk[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const offsetMs = index * CHUNK_SECONDS * 1000;
    if (provider === "local") {
      out.push(...transcribeChunkLocal(chunks[index], offsetMs));
    } else {
      const segments = await transcribeAudioFile({
        filePath: chunks[index],
        offsetMs,
        fallbackDurationMs: CHUNK_SECONDS * 1000
      });
      out.push(...segments.map((segment) => ({ text: segment.text, atMs: segment.startMs })));
    }
  }
  return out;
}

/* ------------------------------- Publico ---------------------------------- */

/** Baja el audio de un video de YouTube y lo transcribe a tramos con atMs real. */
export async function transcribeFromYoutube(url: string): Promise<TranscriptChunk[]> {
  const workDir = mkdtempSync(path.join(tmpdir(), "urbania-yt-"));
  try {
    const audioPath = await downloadYoutubeAudio(url, workDir);
    const chunks = segmentAudio(audioPath, workDir);
    if (!chunks.length) throw new Error("El video no produjo audio segmentable");
    const transcript = await transcribeChunks(chunks);
    if (!transcript.length) throw new Error("Whisper no devolvió texto para este video");
    return transcript;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Transcribe un archivo de audio/video ya subido a tramos con atMs real. */
export async function transcribeFromFile(filePath: string): Promise<TranscriptChunk[]> {
  const workDir = mkdtempSync(path.join(tmpdir(), "urbania-file-"));
  try {
    const chunks = segmentAudio(filePath, workDir);
    if (!chunks.length) throw new Error("El archivo no produjo audio segmentable");
    const transcript = await transcribeChunks(chunks);
    if (!transcript.length) throw new Error("Whisper no devolvió texto para este archivo");
    return transcript;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
