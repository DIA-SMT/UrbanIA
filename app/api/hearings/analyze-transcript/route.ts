import { NextResponse } from "next/server";
import { z } from "zod";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";

const requestSchema = z.object({
  transcript: z.string().trim().min(20).max(60000),
  context: z
    .object({
      title: z.string().max(200).optional(),
      mainTopic: z.string().max(160).optional(),
      relatedProposal: z.string().max(240).optional(),
      relatedArticles: z.array(z.string().max(80)).max(20).optional()
    })
    .optional()
});

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

const draftSchema = z.object({
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Transcripcion invalida" }, { status: 400 });
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json({ error: "Migue no esta configurado para analizar transcripciones." }, { status: 503 });
  }

  const context = parsed.data.context ?? {};
  const transcript = parsed.data.transcript.slice(0, 60000);

  try {
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
                  actorType: "Concejal | Planeamiento Urbano | Vecino | Colegio profesional | Universidad | Camara empresarial | Organizacion barrial | Especialista tecnico | Funcionario municipal",
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
            transcript
          })
        }
      ],
      { maxTokens: 2600, temperature: 0.15 }
    );

    const draft = draftSchema.parse(parseJsonResponse(response.answer));
    return NextResponse.json({ draft, model: response.model, provider: response.provider });
  } catch (error) {
    console.error("Unable to analyze hearing transcript.", error);
    return NextResponse.json({ error: "No pudimos generar el borrador con Migue." }, { status: 502 });
  }
}

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
