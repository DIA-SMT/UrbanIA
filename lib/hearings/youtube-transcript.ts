import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { askUrbanAssistant } from "@/lib/ai/openrouter";
import { canonicalYoutubeUrl } from "@/lib/hearings/youtube-url";

export { canonicalYoutubeUrl };

/** Transcribe y separa voces. Sin razonamiento: barato y no ata nombres. */
const ASR_MODEL = "google/gemini-3-flash-preview";
/** Ata nombres sobre el texto ya transcripto. El razonamiento ES la atribucion. */
const NAMING_MODEL = "google/gemini-3.1-pro-preview";

const CHUNK_SECONDS = 300;
const MAX_PARALLEL = 4;
/** Techo de analyze-transcript. A ~840 chars por minuto, se llega a los ~71 min. */
const TRANSCRIPT_CHAR_LIMIT = 60000;

export type TranscriptResult = {
  transcript: string;
  speakers: SpeakerBinding[];
  durationSec: number;
  costUsd: number;
  truncated: boolean;
};

export type SpeakerBinding = {
  chunkMinute: number;
  localLabel: string;
  name: string | null;
  evidence: string | null;
};

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // shell: false (default). Los argumentos van como array y no se interpolan.
    const child = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} supero el tiempo limite`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo ejecutar ${cmd}: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} fallo (${code}): ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Descarga la pista de audio. Fija el formato m4a (140) a proposito: dejar que
 * yt-dlp elija con `bestaudio` lo lleva al webm, que devuelve HTTP 403 de forma
 * intermitente.
 */
async function downloadAudio(url: string, dir: string): Promise<string> {
  const out = join(dir, "audio.m4a");
  await run("yt-dlp", ["-f", "140", "--no-playlist", "-o", out, url], 300_000);
  return out;
}

async function toChunks(input: string, dir: string): Promise<string[]> {
  // 16 kHz mono: lo que esperan los motores de voz, y una fraccion del tamano.
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-q:a", "6",
     "-f", "segment", "-segment_time", String(CHUNK_SECONDS), join(dir, "chunk-%03d.mp3")],
    300_000
  );

  const files = (await readdir(dir)).filter((f) => /^chunk-\d+\.mp3$/.test(f)).sort();
  return files.map((f) => join(dir, f));
}

async function probeDuration(input: string): Promise<number> {
  const out = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input],
    30_000
  );
  return Math.round(Number.parseFloat(out.trim()) || 0);
}

const asrPrompt = (offsetMin: number) => `Transcribi este tramo de una audiencia publica del Concejo Deliberante de San Miguel de Tucuman sobre el Codigo de Planeamiento Urbano.

Reglas:
1. Formato "[mm:ss] HABLANTE: texto textual", una linea por intervencion.
2. Los timestamps son relativos a este tramo, que empieza en el minuto ${offsetMin} de la audiencia.
3. Separa a los hablantes. Si alguien se presenta o lo nombran al cederle la palabra, usa ese nombre. Si no, "Hablante 1", "Hablante 2", etc.
4. NUNCA inventes un nombre ni lo deduzcas del tema o del cargo. Es un registro publico: "Hablante 2" es mejor que un nombre equivocado.
5. Cita textual. No parafrasees ni corrijas la gramatica de quien habla.
6. Si hay varios hablando a la vez o no se entiende, marca [inaudible].`;

/** Pasada 1. No usa askUrbanAssistant porque necesita mandar audio, no texto. */
async function transcribeChunk(file: string, offsetMin: number): Promise<{ text: string; cost: number }> {
  const audio = (await readFile(file)).toString("base64");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UrbanIA"
    },
    body: JSON.stringify({
      model: ASR_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: asrPrompt(offsetMin) },
            { type: "input_audio", input_audio: { data: audio, format: "mp3" } }
          ]
        }
      ]
    })
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(`Transcripcion del minuto ${offsetMin}: ${json.error?.message ?? res.status}`);
  }

  return { text: json.choices?.[0]?.message?.content ?? "", cost: json.usage?.cost ?? 0 };
}

const NAMING_PROMPT = `Abajo esta la transcripcion de una audiencia publica, hecha en tramos de 5 minutos.

CRITICO: cada tramo numero sus hablantes por separado. El "Hablante 1" de un tramo NO es necesariamente el "Hablante 1" de otro.

Identifica a las personas que hablaron.

Reglas:
1. Un nombre solo vale si esta probado en el texto: la persona se presenta, o alguien la nombra al cederle, agradecerle o responderle.
2. Si no podes probarlo con una cita textual, el nombre es null. NO deduzcas por el tema, el cargo ni la institucion: que alguien hable de vivienda social no prueba que sea quien fue anunciado para hablar de vivienda social. Esto es un registro publico y un nombre equivocado es peor que ninguno.
3. Un nombre dicho en un tramo puede identificar a alguien que hablo en otro. Usa toda la audiencia.

Devolve SOLO un objeto JSON:
{"speakers":[{"chunkMinute":0,"localLabel":"Hablante 1","name":"Nombre o null","evidence":"cita exacta que lo prueba, o null"}]}`;

/** Pasada 2: sobre el texto, sin audio. Los tokens de texto son mucho mas baratos. */
async function bindNames(transcript: string): Promise<{ speakers: SpeakerBinding[]; cost: number }> {
  const res = await askUrbanAssistant(
    [
      { role: "system", content: NAMING_PROMPT },
      { role: "user", content: transcript }
    ],
    // max_tokens explicito: sin techo el modelo reserva 65k y OpenRouter rechaza
    // por credito (HTTP 402) aunque la respuesta ocupe una fraccion.
    { model: NAMING_MODEL, json: true, maxTokens: 6000, temperature: 0 }
  );

  try {
    const raw = res.answer.replace(/^```(?:json)?|```$/gm, "").trim();
    const parsed = JSON.parse(raw) as { speakers?: SpeakerBinding[] };
    return { speakers: Array.isArray(parsed.speakers) ? parsed.speakers : [], cost: 0 };
  } catch {
    // Si el JSON viene roto, el texto transcripto sigue sirviendo: se devuelve sin
    // nombres en vez de perder la transcripcion entera.
    return { speakers: [], cost: 0 };
  }
}

/** Reemplaza las etiquetas locales por los nombres probados, tramo por tramo. */
function applyNames(chunks: { offsetMin: number; text: string }[], speakers: SpeakerBinding[]): string {
  return chunks
    .map(({ offsetMin, text }) => {
      let out = text;

      for (const s of speakers) {
        if (s.chunkMinute !== offsetMin || !s.name || !s.localLabel) continue;
        // Solo despues de un timestamp, para no pisar el nombre dentro del discurso.
        const label = s.localLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`(\\]\\s*\\**\\s*)${label}(\\s*\\**\\s*:)`, "g"), `$1${s.name}$2`);
      }

      return `=== Minuto ${offsetMin} ===\n${out}`;
    })
    .join("\n\n");
}

/**
 * Audio de YouTube -> transcripcion con hablantes identificados, en dos pasadas.
 *
 * Una sola llamada con la audiencia entera NO sirve: el audio entra en contexto
 * pero la salida se estrella contra el techo de ~65k tokens, transcribe unos
 * minutos y despues degenera en silabas sueltas. Y el fallo es silencioso: arranca
 * perfecto. Por eso va por tramos, y por eso el llamador debe mirar `truncated`.
 */
export async function transcribeYoutubeHearing(rawUrl: string): Promise<TranscriptResult> {
  const url = canonicalYoutubeUrl(rawUrl);

  if (!url) {
    throw new Error("El link no parece un video de YouTube valido.");
  }

  const dir = await mkdtemp(join(tmpdir(), "urbania-audiencia-"));

  try {
    const audio = await downloadAudio(url, dir);
    const durationSec = await probeDuration(audio);
    const files = await toChunks(audio, dir);

    if (!files.length) {
      throw new Error("No se pudo extraer audio del video.");
    }

    const results: { offsetMin: number; text: string }[] = [];
    let costUsd = 0;

    for (let i = 0; i < files.length; i += MAX_PARALLEL) {
      const lote = files.slice(i, i + MAX_PARALLEL);
      const done = await Promise.all(
        lote.map((f, k) => transcribeChunk(f, ((i + k) * CHUNK_SECONDS) / 60))
      );

      done.forEach((d, k) => {
        results.push({ offsetMin: ((i + k) * CHUNK_SECONDS) / 60, text: d.text });
        costUsd += d.cost;
      });
    }

    const plano = results.map((r) => `=== Minuto ${r.offsetMin} ===\n${r.text}`).join("\n\n");
    const { speakers } = await bindNames(plano);
    const full = applyNames(results, speakers);

    return {
      transcript: full.slice(0, TRANSCRIPT_CHAR_LIMIT),
      speakers,
      durationSec,
      costUsd,
      truncated: full.length > TRANSCRIPT_CHAR_LIMIT
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
