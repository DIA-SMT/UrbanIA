import "server-only";

import { askUrbanAssistant } from "@/lib/ai/openrouter";

/**
 * Análisis de intención previo al retrieval de Migue. Una consulta escrita en
 * lenguaje coloquial ("quiero canchas en el predio abandonado") matchea mal
 * contra texto normativo, así que antes de buscar:
 *
 * 1) Clasificamos si la consulta requiere revisar normativa urbana (CPU,
 *    planillas, digesto). Si es normativa, la ruta usa el modelo fuerte y suma
 *    la recuperación de artículos por palabra clave (el mismo pipeline que la
 *    Consulta al CPU).
 * 2) Reescribimos la consulta en términos urbanísticos concretos para que el
 *    motor híbrido (vectorial + full-text) recupere fragmentos pertinentes.
 */

export type MigueQuestionAnalysis = {
  /** true si conviene fundamentar con el CPU/planillas/digesto. */
  normativa: boolean;
  /** true si la pregunta es sobre la propia conversación (qué hablamos, resumen). */
  conversacion: boolean;
  /** Consulta reescrita para el retrieval (términos urbanísticos, distritos). */
  consulta: string;
};

const INTENT_MODEL = "openai/gpt-4o-mini";

const INTENT_SYSTEM_PROMPT = [
  "Sos el clasificador de intención de Migue, el asistente urbano de la Municipalidad de San Miguel de Tucumán.",
  "Tu única tarea es analizar la consulta del usuario y devolver un JSON con esta forma exacta:",
  '{"normativa": <true|false>, "conversacion": <true|false>, "consulta": "<consulta reescrita para buscar en la base normativa>"}',
  "",
  "Reglas para pedidos de redacción (evaluá esto PRIMERO, antes que \"conversacion\"):",
  "- Si el usuario pide redactar, armar, escribir, formalizar o mejorar una propuesta, un reclamo o un aporte, NO es \"conversacion\" aunque diga \"con lo que hablamos\" o \"con lo que te conte\": poné conversacion en false.",
  "- En esos casos poné normativa en true: el borrador tiene que fundamentarse en el Código de Planeamiento.",
  "- La consulta reescrita debe describir EL TEMA URBANO del que se habló en el historial, nunca el pedido de redacción en sí.",
  "- Ejemplo: historial sobre una plaza abandonada, con juegos rotos y sin luz + \"redactame la propuesta con lo que hablamos\" → \"espacio publico plaza equipamiento recreativo iluminacion mantenimiento arbolado\".",
  "",
  "Reglas para \"conversacion\" (evaluá esto DESPUÉS):",
  "- true si la pregunta es sobre la propia charla y no pide información nueva ni un texto nuevo: \"¿de qué estuvimos hablando?\", \"¿te acordás?\", \"resumime lo anterior\", \"¿qué te pregunté antes?\".",
  "- Si es true, poné normativa en false y dejá la consulta igual, sin reescribirla.",
  "",
  "Reglas para \"normativa\":",
  "- true si responder bien requiere revisar el Código de Planeamiento Urbano, sus planillas o normativa municipal. El CPU regula: zonificación y distritos, usos del suelo, edificación (alturas, retiros, patios, espacio urbano) y situaciones especiales (countries, patrimonio, equipamiento).",
  "- true igual para reclamos de servicios urbanos (basura, arbolado, luminarias, veredas): aunque el CPU no los regule, conviene buscar por si hay normativa municipal aplicable. Si no aparece nada, Migue lo aclara.",
  "- true también para ideas o propuestas ciudadanas que tocan esos temas (construir, instalar, modificar algo en la ciudad), aunque estén escritas de manera informal.",
  "- false para consultas sobre el uso de la plataforma UrbanIA, redacción general, resúmenes de audiencias o temas sin relación con normativa urbana.",
  "",
  "Reglas para \"consulta\":",
  "- Reescribí la consulta con los términos urbanísticos concretos que usaría el texto de una norma: sustantivos técnicos, códigos de distrito (C2, R1), tipos de uso o parámetros.",
  "- Ejemplo: \"quiero que hagan canchas techadas y una plaza en el predio abandonado de mi barrio\" → \"usos permitidos equipamiento deportivo recreativo plaza espacio público espacio verde\".",
  "- Si la consulta ya es técnica, dejala prácticamente igual.",
  "- Si hay historial y la consulta usa referencias como \"eso\" o \"y en R1?\", resolvelas en la reescritura.",
  "- Máximo 20 palabras, sin muletillas ni cortesía."
].join("\n");

/**
 * Clasifica y reescribe la consulta. Ante cualquier fallo (modelo caído, JSON
 * inválido) cae al comportamiento previo: consulta original, sin marca normativa.
 */
export async function analyzeMigueQuestion(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  options: { attachmentExcerpt?: string } = {}
): Promise<MigueQuestionAnalysis> {
  const fallback: MigueQuestionAnalysis = { normativa: false, conversacion: false, consulta: question };

  try {
    const recentHistory = history
      .slice(-4)
      .map((message) => `${message.role === "user" ? "Usuario" : "Migue"}: ${message.content.slice(0, 240)}`)
      .join("\n");

    const response = await askUrbanAssistant(
      [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            recentHistory ? `Historial reciente:\n${recentHistory}\n` : "",
            // El inicio del documento adjunto suele traer los datos clave (distrito,
            // padrón, superficie) que la reescritura necesita para buscar bien.
            options.attachmentExcerpt
              ? `Inicio del documento adjuntado por el usuario (usalo para precisar la reescritura, por ejemplo el código de distrito):\n${options.attachmentExcerpt}\n`
              : "",
            `Consulta del usuario:\n${question}`
          ].join("\n")
        }
      ],
      { model: INTENT_MODEL, json: true, maxTokens: 120, temperature: 0 }
    );

    const parsed = JSON.parse(response.answer) as { normativa?: unknown; conversacion?: unknown; consulta?: unknown };
    const conversacion = parsed.conversacion === true;
    const consulta = typeof parsed.consulta === "string" && parsed.consulta.trim().length >= 3
      ? parsed.consulta.trim()
      : question;

    return { normativa: !conversacion && parsed.normativa === true, conversacion, consulta };
  } catch (error) {
    console.warn("Migue intent analysis failed, using raw question.", error instanceof Error ? error.message : error);
    return fallback;
  }
}
