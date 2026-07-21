import "server-only";

import { askUrbanAssistant } from "@/lib/ai/openrouter";
import { retrieveRelevantFragments } from "@/lib/ai/rag";
import {
  ALL_TOPICS,
  CPU_TOPICS,
  FALSE_FRIENDS,
  OUT_OF_SCOPE_RELATIONS,
  OUT_OF_SCOPE_TOPIC,
  UNCLASSIFIED_AXIS
} from "@/lib/citizen/contributions";

/**
 * Sugerencia de eje para un aporte ciudadano, apoyada en el Código real.
 *
 * Esto NO es la heurística vieja de la landing, que contaba palabras clave y, cuando
 * no matcheaba ninguna, devolvía igual el primer eje de la lista ("Ambiente") con una
 * "confianza" que era el largo del texto. Acá el modelo recibe la taxonomía real, los
 * fragmentos del Código recuperados para ese texto y los falsos amigos, y tiene que
 * justificar la elección con un artículo.
 *
 * Es una SUGERENCIA: se guarda con axisConfirmed=false y la confirma una persona.
 * Ante cualquier fallo devuelve null y el aporte queda "Sin clasificar", que es la
 * verdad: nadie lo clasificó.
 */

export type TopicSuggestion = {
  axis: string;
  /** Por qué, con el artículo en el que se apoya. Se muestra al equipo municipal. */
  reason: string;
  /**
   * Tema del CPU que el aporte roza cuando el Código no lo regula. La relación ya se
   * pedía en prosa dentro de `reason`, pero en prosa no se puede agrupar: sin este
   * campo el ranking de demanda no puede contar "cuántos reclamos fuera de alcance
   * apuntan a Usos del suelo". Null salvo que el eje sea fuera-de-alcance.
   */
  relatedTopic: string | null;
};

const CLASSIFIER_MODEL = "openai/gpt-4o-mini";

function buildSystemPrompt() {
  return [
    "Sos el clasificador de aportes ciudadanos de UrbanIA (Municipalidad de San Miguel de Tucumán).",
    "Leés lo que escribió un vecino y elegís a qué tema del Código de Planeamiento Urbano corresponde.",
    "Devolvés SOLO un JSON con esta forma exacta:",
    '{"axis": "<etiqueta exacta de la lista>", "reason": "<una frase: por que ese tema, citando el articulo si lo hay>", "relatedTopic": "<etiqueta exacta de un tema del CPU con el que se relaciona, o null>"}',
    "",
    "Temas posibles (usá la etiqueta EXACTA, sin cambiar una letra):",
    ...ALL_TOPICS.map((topic) => `- "${topic.label}": ${topic.summary} Señales: ${topic.hints.join(", ")}.`),
    "",
    "Reglas:",
    `- El Codigo NO regula arbolado, basura, luminarias, veredas rotas, bacheo ni transito. Si el aporte es sobre eso, el eje es "${OUT_OF_SCOPE_TOPIC.label}". No lo fuerces adentro de otro tema.`,
    "- Elegí por lo que el vecino QUIERE resolver, no por una palabra suelta que aparezca en el texto.",
    "- En reason explicá en una sola frase por que elegiste ese tema. Si hay un articulo del Codigo que lo respalde entre los fragmentos, nombralo (por ejemplo: 'Art. 29').",
    `- Si el aporte es "${OUT_OF_SCOPE_TOPIC.label}" y ademas se relaciona con otro tema, decilo en reason asi: "El Codigo no lo regula, pero se relaciona con <tema> (<articulo>)" Y ADEMAS poné ese tema en relatedTopic, con la etiqueta exacta.`,
    ...OUT_OF_SCOPE_RELATIONS.map((relation) => `  · ${relation.subject} -> se relaciona con "${relation.topic}": ${relation.why}.`),
    "- relatedTopic es null salvo en ese caso. Si el eje ya es un tema del CPU, no hay nada que relacionar: null.",
    "- Si no hay una relacion de la lista de arriba que aplique, relatedTopic es null. No la inventes.",
    "- Si el texto no alcanza para decidir (es basura, una prueba o no se entiende), devolvé axis \"\" y reason vacio. No adivines.",
    "",
    "Falsos amigos (MANDAN sobre todo lo anterior: si el unico vinculo sale de aca, no hay relacion):",
    ...FALSE_FRIENDS.map((warning) => `- ${warning}`)
  ].join("\n");
}

const VALID_AXES = new Set(ALL_TOPICS.map((topic) => topic.label));
/** Solo temas del CPU: fuera-de-alcance no puede relacionarse consigo mismo. */
const CPU_TOPIC_LABELS = new Set(CPU_TOPICS.map((topic) => topic.label));

export async function classifyContributionTopic(input: {
  kind: string;
  zone: string;
  text: string;
}): Promise<TopicSuggestion | null> {
  try {
    // Los mismos fragmentos que vería Migue al responder: la sugerencia se apoya en
    // el Código, no en la intuición del modelo. Modo público: es un aporte vecinal.
    const retrieval = await retrieveRelevantFragments(input.text, { mode: "public", topK: 5 }).catch(() => null);
    const evidence = retrieval?.fragments.length
      ? retrieval.fragments
          .slice(0, 4)
          .map((fragment) => `[${fragment.reference ?? fragment.sourceTitle}] ${fragment.content.slice(0, 700)}`)
          .join("\n\n")
      : "No se recuperaron fragmentos del Codigo para este aporte.";

    const response = await askUrbanAssistant(
      [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: [
            `Tipo: ${input.kind}`,
            `Zona: ${input.zone}`,
            `Texto del vecino: ${input.text.slice(0, 1500)}`,
            "",
            "Fragmentos del Codigo recuperados para este texto:",
            evidence
          ].join("\n")
        }
      ],
      { model: CLASSIFIER_MODEL, json: true, maxTokens: 200, temperature: 0 }
    );

    const parsed = JSON.parse(response.answer) as { axis?: unknown; reason?: unknown; relatedTopic?: unknown };
    const axis = typeof parsed.axis === "string" ? parsed.axis.trim() : "";

    // Etiqueta inventada o vacía: preferimos "Sin clasificar" antes que un eje falso.
    if (!axis || !VALID_AXES.has(axis)) {
      return null;
    }

    // El puente solo tiene sentido saliendo de fuera-de-alcance, y solo hacia un tema
    // real del CPU. Cualquier otra cosa que devuelva el modelo se descarta: un
    // relatedTopic inventado contaminaria el ranking de demanda relacionada.
    const suggestedRelation = typeof parsed.relatedTopic === "string" ? parsed.relatedTopic.trim() : "";
    const relatedTopic =
      axis === OUT_OF_SCOPE_TOPIC.label && CPU_TOPIC_LABELS.has(suggestedRelation) ? suggestedRelation : null;

    return {
      axis,
      reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 400) : "",
      relatedTopic
    };
  } catch (error) {
    console.warn("No se pudo sugerir el eje del aporte.", error instanceof Error ? error.message : error);
    return null;
  }
}

export { UNCLASSIFIED_AXIS };
