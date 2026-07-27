// Binarios de audio de la ingesta de audiencias, resueltos SIN depender del
// PATH del sistema: yt-dlp se autodescarga a node_modules/.cache y ffmpeg viene
// embebido en el paquete ffmpeg-static. Asi la maquina de quien corre el worker
// no necesita instalar nada.
//
// NO es "server-only": lo comparten la ingesta batch dentro de Next y el worker
// CLI, que corre con tsx fuera de Next.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const YTDLP_RELEASES = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytdlpAssetName(): string {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return "yt-dlp_linux";
}

/**
 * Ruta a yt-dlp. Usa YTDLP_PATH si esta seteado, si no lo descarga una vez a
 * node_modules/.cache/urbania y lo reutiliza.
 */
export async function ensureYtDlp(): Promise<string> {
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

/** Ruta al ffmpeg embebido. Lanza si la plataforma no trae binario. */
export function ensureFfmpeg(): string {
  if (!ffmpegPath) throw new Error("ffmpeg-static no trae binario para esta plataforma");
  return ffmpegPath;
}

export type RunResult = { stdout: string; stderr: string; code: number | null };

/**
 * Corre un binario SIN bloquear el event loop y con timeout.
 *
 * `tolerateFailure` sirve para los casos donde el codigo de salida != 0 es
 * esperable y lo util esta en la salida (ffmpeg sin `-o` para leer metadatos).
 */
export function run(
  command: string,
  args: string[],
  timeoutMs: number,
  label: string,
  options: { tolerateFailure?: boolean } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
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
      if (code === 0 || options.tolerateFailure) return resolve({ stdout, stderr, code });
      const detail = `${stderr}${stdout}`.trim().slice(-400);
      reject(new Error(`${label} falló (${code}): ${detail || "sin detalle"}`));
    });
  });
}

/**
 * Duracion del audio en segundos, leida del propio ffmpeg.
 *
 * Se evita ffprobe a proposito: no viene embebido y sumar ffprobe-static seria
 * una dependencia mas solo para un dato informativo. ffmpeg sin archivo de
 * salida imprime "Duration: HH:MM:SS.cs" en stderr y termina con codigo != 0,
 * que es esperable. Devuelve 0 si no se puede determinar: la duracion no es
 * critica para transcribir.
 */
export async function probeDurationSec(inputPath: string): Promise<number> {
  try {
    const { stderr } = await run(ensureFfmpeg(), ["-hide_banner", "-i", inputPath], 60_000, "ffmpeg", {
      tolerateFailure: true
    });
    const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d{1,2})/);
    if (!match) return 0;
    const [, hours, minutes, seconds] = match;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  } catch {
    return 0;
  }
}
