// Sin "server-only": este modulo tambien lo importa el worker CLI de ingesta
// (scripts/ingest-youtube-hearings.ts), que corre con tsx fuera de Next.
import { z } from "zod";
import { askUrbanAssistant } from "@/lib/ai/openrouter";
import { emptyHearingConclusions, type HearingConclusions } from "@/lib/hearings/shared";

/**
 * Analisis estructurado de una transcripcion de audiencia publica (resumen,
 * participantes, temas). Lo comparten la ruta analyze-transcript (borrador del
 * formulario) y el cierre de la audiencia en vivo (finalize).
 */

const stringArraySchema = z.array(z.string()).default([]);

const participantSchema = z.object({
  name: z.string().default("Participante sin identificar"),
  institution: z.string().default("Pendiente de validar"),
  role: z.string().default("Participante detectado"),
  actorType: z.string().default("Vecino"),
  intervention: z.string().default("Intervencion detectada en transcripcion. Requiere revision manual.")
});

const observedTopicSchema = z.object({
  topic: z.string().default("Tema detectado"),
  description: z.string().default("Tema detectado por Migue en la transcripcion de la audiencia."),
  importance: z.enum(["Bajo", "Medio", "Alto", "Critico"]).default("Medio"),
  relatedArticle: z.string().default("Pendiente de cruce normativo"),
  relatedProposal: z.string().default("Propuesta pendiente de identificar"),
  technicalObservation: z.string().default("Pendiente de validacion tecnica municipal."),
  citizenObservation: z.string().default("Sin observacion ciudadana especifica detectada.")
});

export const hearingDraftSchema = z.object({
  summary: z.string().default("Resumen pendiente de validacion."),
  keyPoints: stringArraySchema,
  participants: z.array(participantSchema).default([]),
  title: z.string().optional(),
  mainTopic: z.string().default("Tematica pendiente"),
  secondaryTopics: stringArraySchema,
  relatedArticles: stringArraySchema,
  relatedProposal: z.string().default("Propuesta pendiente de identificar"),
  conclusions: z
    .object({
      summary: z.string().default("Resumen pendiente de validacion."),
      agreements: z.string().default("Sin acuerdos claros detectados."),
      disagreements: z.string().default("Sin desacuerdos claros detectados."),
      nextSteps: z.string().default("Revisar transcripcion y completar responsables."),
      technicalRecommendations: z.string().default("Pendiente de validacion tecnica municipal."),
      decisions: z.string().default("Sin decisiones tomadas detectadas."),
      proposalStatusAfter: z.string().default("En tratamiento")
    })
    .default({}),
  observedTopics: z.array(observedTopicSchema).default([])
});

export type HearingDraft = z.infer<typeof hearingDraftSchema>;

/** El schema del analisis usa "Critico" sin tilde; la ficha usa "Crítico". */
function normalizeImportance(value: string): string {
  const map: Record<string, string> = { Critico: "Crítico" };
  return map[value] ?? value;
}

/** Mapea el borrador IA a la ficha de conclusiones editable (foto 2). */
export function draftToConclusions(draft: HearingDraft): HearingConclusions {
  const base = emptyHearingConclusions();
  const c = draft.conclusions;
  const topics = draft.observedTopics;
  const joinTopics = topics.map((topic) => topic.topic).filter(Boolean).join(", ");
  const fallbackTopics = [draft.mainTopic, ...draft.secondaryTopics].filter(Boolean).join(", ");

  return {
    summary: c.summary || draft.summary || base.summary,
    agreements: c.agreements,
    disagreements: c.disagreements,
    nextSteps: c.nextSteps,
    technicalRecommendations: c.technicalRecommendations,
    decisions: c.decisions,
    proposalStatusAfter: c.proposalStatusAfter,
    observedTopics: joinTopics || fallbackTopics,
    importance: normalizeImportance(topics[0]?.importance ?? base.importance),
    technicalObservation: topics.map((topic) => topic.technicalObservation).filter(Boolean).join(" "),
    citizenObservation: topics.map((topic) => topic.citizenObservation).filter(Boolean).join(" ")
  };
}

export type HearingAnalysisContext = {
  title?: string;
  mainTopic?: string;
  relatedProposal?: string;
  relatedArticles?: string[];
};

function parseJsonResponse(value: string) {
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const jsonStart = withoutFence.indexOf("{");
  const jsonEnd = withoutFence.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Model response did not contain JSON.");
  }

  return JSON.parse(withoutFence.slice(jsonStart, jsonEnd + 1));
}

export async function analyzeHearingTranscript(
  transcript: string,
  context: HearingAnalysisContext = {}
): Promise<{ draft: HearingDraft; model: string | null; provider: string | null }> {
  const response = await askUrbanAssistant(
    [
      {
        role: "system",
        content: [
          "Sos Migue, asistente IA de UrbanIA para audiencias publicas municipales.",
          "Analiza transcripciones reales y devuelve SOLO JSON valido.",
          "No copies bloques largos de la transcripcion: sintetiza, agrupa y extrae informacion accionable.",
          "Cuando no sepas un dato, usa textos breves como 'Pendiente de validar'.",
          "No inventes fechas ni articulos si no aparecen."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generar borrador estructurado para autocompletar formulario de audiencia publica.",
          requiredShape: {
            summary: "Sintesis ejecutiva de 4 a 7 oraciones.",
            keyPoints: ["Punto clave sintetico"],
            participants: [
              {
                name: "Nombre detectado",
                institution: "Institucion o Pendiente de validar",
                role: "Rol",
                actorType:
                  "Concejal | Planeamiento Urbano | Vecino | Colegio profesional | Universidad | Camara empresarial | Organizacion barrial | Especialista tecnico | Funcionario municipal",
                intervention: "Resumen breve de su postura o aporte"
              }
            ],
            title: "Titulo sugerido para la audiencia",
            mainTopic: "Tematica principal",
            secondaryTopics: ["Tematica secundaria"],
            relatedArticles: ["Articulo 12"],
            relatedProposal: "Propuesta tratada",
            conclusions: {
              summary: "Resumen general",
              agreements: "Acuerdos sintetizados",
              disagreements: "Desacuerdos sintetizados",
              nextSteps: "Proximos pasos sintetizados",
              technicalRecommendations: "Recomendaciones tecnicas",
              decisions: "Decisiones tomadas detectadas",
              proposalStatusAfter: "Estado posterior sugerido"
            },
            observedTopics: [
              {
                topic: "Tema observado",
                description: "Descripcion breve",
                importance: "Bajo | Medio | Alto | Critico",
                relatedArticle: "Articulo o Pendiente de cruce normativo",
                relatedProposal: "Propuesta relacionada",
                technicalObservation: "Observacion tecnica sintetizada",
                citizenObservation: "Observacion ciudadana sintetizada"
              }
            ]
          },
          context,
          transcript: transcript.slice(0, 60000)
        })
      }
    ],
    { maxTokens: 2600, temperature: 0.15 }
  );

  const draft = hearingDraftSchema.parse(parseJsonResponse(response.answer));
  return { draft, model: response.model, provider: response.provider };
}
