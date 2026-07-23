import { createReadStream } from "node:fs";
import OpenAI from "openai";

/**
 * Transcripcion de audio (Whisper) a traves de OpenRouter, con la misma
 * OPENROUTER_API_KEY que usa el resto de la IA del proyecto: OpenRouter expone
 * el endpoint /audio/transcriptions y lo rutea al proveedor. No hace falta una
 * clave aparte de OpenAI.
 *
 * Devuelve segmentos con timestamps reales, que es lo que permite anclar cada
 * cruce normativo al minuto exacto de la audiencia.
 */

export const DEFAULT_TRANSCRIPTION_MODEL = "openai/whisper-1";

export type TranscriptionSegment = { startMs: number; endMs: number; text: string };

type VerboseTranscription = {
  text?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
};

export function hasTranscriptionConfig(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Transcribe un archivo de audio. `offsetMs` desplaza los timestamps cuando el
 * archivo es un chunk de una grabacion mas larga.
 */
export async function transcribeAudioFile({
  filePath,
  offsetMs = 0,
  fallbackDurationMs = 0,
  language = "es"
}: {
  filePath: string;
  offsetMs?: number;
  fallbackDurationMs?: number;
  language?: string;
}): Promise<TranscriptionSegment[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENROUTER_API_KEY: la transcripcion corre por OpenRouter.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UrbanIA"
    }
  });

  const response = await client.audio.transcriptions.create({
    file: createReadStream(filePath),
    model: process.env.OPENROUTER_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL,
    language,
    response_format: "verbose_json"
  });

  const verbose = response as unknown as VerboseTranscription;
  const segments: TranscriptionSegment[] = [];

  if (verbose.segments?.length) {
    for (const segment of verbose.segments) {
      const text = segment.text.trim();
      if (!text) continue;
      segments.push({
        startMs: offsetMs + Math.round(segment.start * 1000),
        endMs: offsetMs + Math.round(segment.end * 1000),
        text
      });
    }
    return segments;
  }

  // Algunos proveedores ignoran verbose_json y devuelven solo el texto plano.
  const plain = verbose.text?.trim();
  if (plain) {
    segments.push({ startMs: offsetMs, endMs: offsetMs + fallbackDurationMs, text: plain });
  }
  return segments;
}
