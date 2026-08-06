import { parseTranscriptSegments, type ParsedSegment } from "@/lib/hearings/transcript-segments";

/**
 * Transcripcion de un tramo de audio con Gemini, separando oradores.
 *
 * Por que no Whisper: medido sobre audio real de una prueba en sala, whisper-1
 * devolvia "Un vuelo probando, 1, 2, 3, vola, vola..." donde se habia dicho
 * "hola probando 1 2 3 hola hola". Sembrarle vocabulario con el parametro
 * `prompt` no cambio NADA (texto identico caracter por caracter). Gemini con el
 * prompt de audiencias recupero las palabras, ademas separa hablantes y salio
 * mas barato: US$0,00037 por 7 s, o sea ~US$0,38 por audiencia de dos horas
 * contra ~0,72 de Whisper.
 *
 * Es el mismo motor y el mismo prompt que ya usaba la ingesta de YouTube. La
 * llamada esta escrita aca en vez de compartida con youtube-transcript.ts a
 * proposito: ese archivo es de Agustin y esta en desarrollo activo; unificarlas
 * ahora es pelearse en un merge. Vale unificar cuando su parte se aquiete.
 *
 * Acepta el webm que graba el navegador SIN convertir (verificado): eso es lo
 * que permite que no haga falta ffmpeg dentro de la funcion serverless.
 */

const ASR_MODEL = process.env.HEARING_ASR_MODEL || "google/gemini-3-flash-preview";

/** Formatos que puede grabar MediaRecorder, mapeados a lo que espera la API. */
function audioFormat(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension === "ogg" || extension === "mp4" || extension === "mp3" || extension === "wav" ? extension : "webm";
}

const PROMPT = `Transcribi este tramo de una audiencia publica del Concejo Deliberante de San Miguel de Tucuman sobre el Codigo de Planeamiento Urbano.

Reglas:
1. Formato "[mm:ss] HABLANTE: texto textual", una linea por intervencion.
2. Los timestamps son relativos a este tramo, que arranca en 00:00.
3. Separa a los hablantes. Si alguien se presenta o lo nombran al cederle la palabra, usa ese nombre. Si no, "Hablante 1", "Hablante 2", etc.
4. NUNCA inventes un nombre ni lo deduzcas del tema o del cargo. Es un registro publico: "Hablante 2" es mejor que un nombre equivocado.
5. Cita textual. No parafrasees ni corrijas la gramatica de quien habla. Es español rioplatense de Argentina: respeta el voseo y la forma de hablar de la zona.
6. Si hay varios hablando a la vez o no se entiende, marca [inaudible] EN ESE PUNTO.
7. No inventes contenido para rellenar. Pero transcribi SIEMPRE todo lo que si se entienda, por corto o suelto que sea: una prueba de microfono o una frase aislada tambien van transcriptas.`;

export type AsrResult = { segments: ParsedSegment[]; costUsd: number; raw: string };

/**
 * Transcribe UN tramo. Los timestamps vuelven ya desplazados por `offsetMs`,
 * o sea en el minuto real de la audiencia y no en el del tramo.
 */
export async function transcribeChunkWithSpeakers({
  bytes,
  fileName,
  offsetMs = 0
}: {
  bytes: Uint8Array;
  fileName: string;
  offsetMs?: number;
}): Promise<AsrResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Falta OPENROUTER_API_KEY: la transcripcion corre por OpenRouter.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            { type: "text", text: PROMPT },
            { type: "input_audio", input_audio: { data: Buffer.from(bytes).toString("base64"), format: audioFormat(fileName) } }
          ]
        }
      ]
    })
  });

  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(`Transcripcion del tramo: ${json.error?.message ?? `HTTP ${response.status}`}`);
  }

  const raw: string = json.choices?.[0]?.message?.content?.trim() ?? "";
  const costUsd: number = json.usage?.cost ?? 0;

  // El modelo puede no respetar el formato: en ese caso el texto no se tira, se
  // guarda como una sola intervencion sin orador. Mejor sin etiquetas que nada.
  const parsed = parseTranscriptSegments(raw);
  const segments: ParsedSegment[] = parsed.length
    ? parsed.map((segment) => ({
        ...segment,
        startMs: segment.startMs + offsetMs,
        endMs: segment.endMs + offsetMs
      }))
    : raw && raw !== "[inaudible]"
      ? [{ startMs: offsetMs, endMs: offsetMs, speakerLabel: "Audiencia en vivo", content: raw }]
      : [];

  return { segments, costUsd, raw };
}
