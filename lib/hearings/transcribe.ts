// Transcripcion de audio para la ingesta batch (YouTube / archivo subido).
// NO es "server-only": lo importa el worker CLI (scripts) que corre con tsx
// fuera de Next. Depende de binarios del SISTEMA (yt-dlp, ffmpeg, y opcional un
// Whisper local): son dependencias del entorno del JOB, no del build de Next.
// Documentadas en components/hearings/README.md.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
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

/**
 * Corre un binario SIN bloquear el event loop.
 *
 * Antes esto usaba spawnSync, y como la ruta /api/hearings/ingest dispara el
 * job dentro del proceso de Next, transcodear una audiencia de dos horas
 * dejaba a TODA la app sin responder: ni otras requests, ni el intervalo del
 * latido (con lo cual la propia audiencia se marcaba como trabada y el worker
 * encolaba un segundo job sobre ella).
 */
function run(command: string, args: string[], timeoutMs: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (data) => (stdout += data));
    child.stderr?.on("data", (data) => (stderr += data));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo ejecutar ${label}: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`${label} superó el tiempo límite`));
      if (code === 0) return resolve();
      const detail = `${stderr}${stdout}`.trim().slice(-400);
      reject(new Error(`${label} falló (${code}): ${detail || "sin detalle"}`));
    });
  });
}

async function downloadYoutubeAudio(url: string, workDir: string): Promise<string> {
  const ytdlpPath = await ensureYtDlp();
  await run(
    ytdlpPath,
    ["-f", "bestaudio/best", "--no-playlist", "--no-progress", "-o", path.join(workDir, "audio-original.%(ext)s"), url],
    30 * 60 * 1000,
    "yt-dlp"
  );
  const downloaded = readdirSync(workDir).find((file) => file.startsWith("audio-original."));
  if (!downloaded) throw new Error("yt-dlp no dejó ningún archivo de audio");
  return path.join(workDir, downloaded);
}

/* ------------------------------- ffmpeg ----------------------------------- */

/** Sin timeout, un ffmpeg colgado dejaba el job (y antes, el server) trabado para siempre. */
const FFMPEG_TIMEOUT_MS = 60 * 60 * 1000;

async function segmentAudio(inputPath: string, workDir: string): Promise<string[]> {
  if (!ffmpegPath) throw new Error("ffmpeg-static no trae binario para esta plataforma");
  const pattern = path.join(workDir, "chunk-%03d.mp3");
  await run(
    ffmpegPath,
    ["-hide_banner", "-loglevel", "error", "-i", inputPath, "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "segment", "-segment_time", String(CHUNK_SECONDS), pattern],
    FFMPEG_TIMEOUT_MS,
    "ffmpeg"
  );
  return readdirSync(workDir)
    .filter((file) => file.startsWith("chunk-") && file.endsWith(".mp3"))
    .sort()
    .map((file) => path.join(workDir, file));
}

/* ---------------------------- Whisper (chunks) ---------------------------- */

/** Whisper local (whisper.cpp / faster-whisper) que emite un .srt junto al audio. */
async function transcribeChunkLocal(chunkPath: string, offsetMs: number): Promise<TranscriptChunk[]> {
  const bin = process.env.WHISPER_LOCAL_BIN;
  if (!bin) throw new Error("HEARING_WHISPER_PROVIDER=local requiere WHISPER_LOCAL_BIN");

  const model = process.env.WHISPER_LOCAL_MODEL || "";
  const args = ["-f", chunkPath, "-l", "es", "-osrt", "-of", chunkPath.replace(/\.mp3$/, "")];
  if (model) args.push("-m", model);

  await run(bin, args, 60 * 60 * 1000, "Whisper local");
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
      out.push(...(await transcribeChunkLocal(chunks[index], offsetMs)));
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
    const chunks = await segmentAudio(audioPath, workDir);
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
    const chunks = await segmentAudio(filePath, workDir);
    if (!chunks.length) throw new Error("El archivo no produjo audio segmentable");
    const transcript = await transcribeChunks(chunks);
    if (!transcript.length) throw new Error("Whisper no devolvió texto para este archivo");
    return transcript;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
