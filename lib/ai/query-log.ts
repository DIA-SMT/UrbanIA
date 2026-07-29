import { prisma } from "@/lib/db/prisma";
import type { AnswerSource, RagRetrieval } from "@/lib/ai/rag";

/**
 * Registro de consultas a Migue en AiQuery. Es telemetría, no funcionalidad:
 * jamás puede romper una respuesta del chat, por eso nunca lanza. La lectura
 * de estos datos (panel "qué pregunta la gente") vendrá después; mientras
 * tanto, cada día que pasa acumula evidencia de qué le preocupa a la gente.
 */

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

  try {
    await prisma.aiQuery.create({
      data: {
        question: entry.question.slice(0, 2000),
        answer: entry.answer.slice(0, 4000),
        sources: entry.retrieval.sources.map((source) => ({
          chunkId: source.chunkId,
          title: source.title,
          reference: source.reference ?? null
        })),
        answered,
        normative: entry.normative,
        mode: entry.mode,
        module: entry.module
      }
    });
  } catch (error) {
    console.warn("No se pudo registrar la consulta de Migue.", error instanceof Error ? error.message : error);
  }
}
