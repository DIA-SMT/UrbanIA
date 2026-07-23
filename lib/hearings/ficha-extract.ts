import "server-only";

import { z } from "zod";
import { askUrbanAssistant } from "@/lib/ai/openrouter";
import { actorTypeOptions, proposalSourceOptions, type HearingFicha } from "@/lib/hearings/shared";

/**
 * Extrae los campos de la ficha (foto 1) a partir de la transcripcion del
 * debate, para el boton "Completar con IA" de la sesion en vivo. Es una
 * extraccion liviana y dedicada (se puede correr varias veces): solo devuelve
 * lo que aparece explicitamente en el tramo, sin inventar. La IA orienta; el
 * operador corrige.
 */

const outputSchema = z.object({
  mainTopic: z.string().default(""),
  secondaryTopics: z.string().default(""),
  relatedProposal: z.string().default(""),
  proposalSource: z.string().default(""),
  author: z.string().default(""),
  relatedArticles: z.string().default(""),
  participants: z.string().default(""),
  institution: z.string().default(""),
  role: z.string().default(""),
  actorType: z.string().default(""),
  intervention: z.string().default("")
});

function parseJson(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvio JSON.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

/** Un valor de select solo se acepta si esta entre las opciones permitidas. */
function pickOption(value: string, options: string[]): string {
  const trimmed = value.trim();
  return options.includes(trimmed) ? trimmed : "";
}

export async function extractFichaFromTranscript(transcript: string): Promise<Partial<HearingFicha>> {
  const response = await askUrbanAssistant(
    [
      {
        role: "system",
        content: [
          "Sos Migue, asistente de UrbanIA. Extraes los datos de la ficha de una audiencia publica a partir de la transcripcion del debate.",
          "Reglas: completa SOLO lo que aparece explicitamente en la transcripcion. Si un dato no esta, deja el string vacio (\"\"). No inventes nombres, instituciones, propuestas ni articulos.",
          `"proposalSource" solo puede ser uno de: ${proposalSourceOptions.join(", ")}; si no queda claro, vacio.`,
          `"actorType" solo puede ser uno de: ${actorTypeOptions.join(", ")}; si no queda claro, vacio.`,
          "\"participants\" = nombres de los participantes separados por comas. \"institution\" = organizacion principal mencionada. \"relatedArticles\" = articulos citados (ej. \"Articulo 12, Articulo 18\"). \"intervention\" = resumen breve (1-2 oraciones) de las posturas o aportes.",
          "Devolves EXCLUSIVAMENTE un objeto JSON con estas claves exactas: mainTopic, secondaryTopics, relatedProposal, proposalSource, author, relatedArticles, participants, institution, role, actorType, intervention.",
          "Espanol rioplatense institucional."
        ].join("\n")
      },
      {
        role: "user",
        content: ["TRANSCRIPCION DEL DEBATE (tramo dictado):", transcript.slice(0, 24000), "", "Extrae los datos de la ficha en el JSON pedido."].join("\n")
      }
    ],
    { model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini", json: true, temperature: 0.1, maxTokens: 900 }
  );

  const parsed = outputSchema.safeParse(parseJson(response.answer));
  if (!parsed.success) return {};

  const data = parsed.data;
  const result: Partial<HearingFicha> = {};
  const put = (key: keyof HearingFicha, value: string) => {
    if (value.trim().length > 0) result[key] = value.trim();
  };

  put("mainTopic", data.mainTopic);
  put("secondaryTopics", data.secondaryTopics);
  put("relatedProposal", data.relatedProposal);
  put("proposalSource", pickOption(data.proposalSource, proposalSourceOptions));
  put("author", data.author);
  put("relatedArticles", data.relatedArticles);
  put("participants", data.participants);
  put("institution", data.institution);
  put("role", data.role);
  put("actorType", pickOption(data.actorType, actorTypeOptions));
  put("intervention", data.intervention);

  return result;
}
