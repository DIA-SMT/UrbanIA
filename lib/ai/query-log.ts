import { prisma } from "@/lib/db/prisma";
import type { AnswerSource, RagRetrieval } from "@/lib/ai/rag";

/**
 * Registro de consultas a Migue en AiQuery. Es telemetría, no funcionalidad:
 * jamás puede romper una respuesta del chat, por eso nunca lanza.
 *
 * Entran las dos vías por las que se le pregunta a Migue: el chat flotante
 * (`logAssistantQuery`) y la consulta del Código (`logCpuQuery`). Van a la misma
 * tabla a propósito, con `module` para distinguirlas: la pregunta "qué le cuesta
 * responder" no se contesta mirando cada canal por separado. Se lee en
 * /admin/configuracion/migue.
 *
 * AiQuery NO guarda userId, y es deliberado: alcanza para medir demanda y no
 * construye un registro de qué preguntó cada vecino identificado.
 */

type LoggedSource = { chunkId: string | null; title: string | null; reference: string | null };

/**
 * Escritura común. Privada: quien registra una consulta debería pasar por una de
 * las dos funciones de abajo, que son las que saben calcular `answered` con la
 * evidencia propia de su canal.
 */
async function writeAiQuery(entry: {
  question: string;
  answer: string;
  sources: LoggedSource[];
  answered: boolean;
  normative: boolean;
  discarded: boolean;
  mode: string;
  module: string;
}): Promise<void> {
  try {
    await prisma.aiQuery.create({
      data: {
        question: entry.question.slice(0, 2000),
        answer: entry.answer.slice(0, 4000),
        sources: entry.sources,
        answered: entry.answered,
        normative: entry.normative,
        discarded: entry.discarded,
        mode: entry.mode,
        module: entry.module
      }
    });
  } catch (error) {
    console.warn("No se pudo registrar la consulta de Migue.", error instanceof Error ? error.message : error);
  }
}

// Patrones con los que Migue reconoce que no tiene respaldo ("no encontré
// información suficiente", "no se encontró información específica", "no tengo
// información sobre eso"). Si aparecen, la consulta cuenta como hueco aunque el
// retrieval haya traído fragmentos: trajo algo, pero no lo que hacía falta.
const NO_ANSWER_PATTERNS = [/no (se )?encontr\w+ (\w+ ){0,3}informacion/, /no (tengo|hay|existe) informacion/, /no dispon\w+ de informacion/];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function answerLooksUnanswered(answer: string): boolean {
  const plain = normalize(answer);
  return NO_ANSWER_PATTERNS.some((pattern) => pattern.test(plain));
}

export async function logAssistantQuery(entry: {
  question: string;
  answer: string;
  retrieval: RagRetrieval;
  /** La fuente citada que se le muestra al usuario; null = Migue no pudo citar. */
  source: AnswerSource | null;
  normative: boolean;
  /** El mensaje no era una consulta (ver `descartable` del clasificador). */
  discarded: boolean;
  mode: string;
  module: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  // Un hueco de conocimiento es una consulta normativa que quedó sin respaldo.
  // La señal principal es estructural, no textual: si Migue no citó nada
  // (source null, porque su JSON vino con cita vacía), no tuvo evidencia con la
  // que respaldarse — sin importar con qué palabras lo haya dicho. Los patrones
  // de texto quedan como refuerzo para respuestas contradictorias.
  const answered =
    !entry.normative || (entry.retrieval.hasEvidence && entry.source !== null && !answerLooksUnanswered(entry.answer));

  await writeAiQuery({
    question: entry.question,
    answer: entry.answer,
    sources: entry.retrieval.sources.map((source) => ({
      chunkId: source.chunkId,
      title: source.title,
      reference: source.reference ?? null
    })),
    answered,
    normative: entry.normative,
    discarded: entry.discarded,
    mode: entry.mode,
    module: entry.module
  });
}

/**
 * Consulta del Código (pantalla Consulta CPU). Toda consulta de este canal es
 * normativa por definición: se pregunta sobre el Código y nada más.
 *
 * La señal de hueco es la misma idea que en el chat, con la evidencia que este
 * canal produce: si la respuesta no citó NI un artículo NI un documento, Migue no
 * tuvo con qué respaldarse. Los patrones de texto quedan como refuerzo para
 * respuestas que citan algo y aun así admiten no saber.
 */
export async function logCpuQuery(entry: {
  question: string;
  answer: string;
  citations: { number: string; title: string }[];
  documents: { label: string; source: string }[];
  /** El mensaje no era una consulta (ver `descartable` del clasificador). */
  discarded: boolean;
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  // Una descartada nunca es un hueco de conocimiento: no había nada que responder.
  const answered =
    entry.discarded || ((entry.citations.length > 0 || entry.documents.length > 0) && !answerLooksUnanswered(entry.answer));

  await writeAiQuery({
    question: entry.question,
    answer: entry.answer,
    // Artículos y documentos entran con la misma forma para que el ranking de
    // fuentes más consultadas los cuente juntos.
    sources: [
      ...entry.citations.map((citation) => ({
        chunkId: null,
        title: citation.title,
        reference: `Art. ${citation.number}`
      })),
      ...entry.documents.map((document) => ({
        chunkId: null,
        title: document.label,
        reference: document.source
      }))
    ],
    answered,
    // Una descartada no es una consulta normativa, aunque haya entrado por el
    // canal del Código.
    normative: !entry.discarded,
    discarded: entry.discarded,
    mode: "cpu",
    module: "consulta-cpu"
  });
}
