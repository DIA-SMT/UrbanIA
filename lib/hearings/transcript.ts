/**
 * Parseo de transcripciones subidas: TXT (parrafos), VTT y SRT (con
 * timestamps). Devuelve tramos normalizados. Es texto puro: sin binarios ni
 * red, por eso este camino es el fallback confiable de la ingesta batch.
 */

/**
 * Un tramo de transcripcion. `speaker` solo viene de las fuentes que separan
 * voces (la transcripcion de YouTube en dos pasadas); el resto lo deja vacio y
 * cae en la etiqueta generica de la audiencia.
 */
export type TranscriptChunk = { text: string; atMs?: number; speaker?: string | null };

export type TranscriptFormat = "txt" | "vtt" | "srt";

/** Convierte "HH:MM:SS.mmm" o "HH:MM:SS,mmm" (o "MM:SS.mmm") a milisegundos. */
function timestampToMs(raw: string): number | undefined {
  const match = raw.trim().match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);
  if (!match) return undefined;
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const millis = Number.parseInt(match[4].padEnd(3, "0"), 10);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

/** Detecta el formato por extension y, si no alcanza, por el contenido. */
export function detectTranscriptFormat(name: string, content: string): TranscriptFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".srt")) return "srt";
  if (lower.endsWith(".txt")) return "txt";

  const head = content.slice(0, 400);
  if (/^\s*WEBVTT/.test(head)) return "vtt";
  if (/-->/.test(head) && /\d{2}:\d{2}:\d{2},\d{3}/.test(head)) return "srt";
  if (/-->/.test(head)) return "vtt";
  return "txt";
}

const CUE_TIMESTAMP = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

/** VTT y SRT comparten estructura de bloques separados por linea en blanco. */
function parseCued(content: string): TranscriptChunk[] {
  const blocks = content.replace(/^﻿/, "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  const chunks: TranscriptChunk[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (/^WEBVTT/i.test(lines[0])) continue;

    const cueLineIndex = lines.findIndex((line) => CUE_TIMESTAMP.test(line));
    if (cueLineIndex === -1) continue;

    const atMs = timestampToMs(lines[cueLineIndex].split("-->")[0]);
    const textLines = lines.slice(cueLineIndex + 1).filter((line) => !/^\d+$/.test(line));
    // Los subtitulos suelen traer tags <c>, <v Nombre> y marcas <00:00:00.000>.
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) chunks.push({ text, atMs });
  }

  return chunks;
}

function parsePlainText(content: string): TranscriptChunk[] {
  return content
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((text) => ({ text }));
}

export function parseTranscriptFile(name: string, content: string): TranscriptChunk[] {
  const format = detectTranscriptFormat(name, content);
  const chunks = format === "txt" ? parsePlainText(content) : parseCued(content);
  // Si un VTT/SRT no dejo nada util, caemos a texto plano para no perder el aporte.
  if (!chunks.length && format !== "txt") return parsePlainText(content);
  return chunks;
}

/** Texto completo de la transcripcion, para el resumen estructurado. */
export function chunksToTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((chunk) => chunk.text).join("\n\n");
}
