import { NextResponse } from "next/server";
import { z } from "zod";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { buildMigueSystemPrompt, buildMigueUserPrompt, normalizeMigueContext } from "@/lib/ai/migue";
import { buildAnswerSource, buildRagContextBlock, retrieveRelevantFragments, type RagRetrieval } from "@/lib/ai/rag";

const assistantQuerySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  context: z.string().trim().max(4000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000)
      })
    )
    .max(10)
    .optional(),
  assistantContext: z
    .object({
      mode: z.enum(["public", "internal"]).optional(),
      module: z
        .enum([
          "landing",
          "propuestas",
          "espacios_verdes",
          "planeamiento",
          "gemelo_digital",
          "dashboard",
          "audiencias",
          "documentos",
          "asistente"
        ])
        .optional(),
      role: z.enum(["citizen", "employee", "admin"]).optional(),
      page: z.string().trim().max(120).optional(),
      intent: z.string().trim().max(160).optional()
    })
    .optional()
});

function parseAssistantPayload(raw: string): { answer: string; cita: string } {
  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; cita?: unknown };

    if (parsed && typeof parsed.answer === "string") {
      return {
        answer: parsed.answer,
        cita: typeof parsed.cita === "string" ? parsed.cita : ""
      };
    }
  } catch {
    // El modelo no devolvió JSON válido: usamos el texto crudo como respuesta.
  }

  return { answer: raw, cita: "" };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = assistantQuerySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Consulta invalida",
        detail: "La pregunta debe tener entre 3 y 2000 caracteres."
      },
      { status: 400 }
    );
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      {
        error: "Asistente no disponible",
        detail: "El servicio de análisis todavía no está habilitado para esta instancia."
      },
      { status: 503 }
    );
  }

  try {
    const assistantContext = normalizeMigueContext(parsed.data.assistantContext);
    const context =
      parsed.data.context ||
      "MVP con mapa urbano, propuestas, Codigo de Planeamiento, audiencias, documentos y participacion ciudadana.";
    const history = parsed.data.history ?? [];

    // Retrieval semántico (motor híbrido local). Si falla, seguimos sin evidencia
    // para no tumbar el asistente.
    let retrieval: RagRetrieval = { fragments: [], sources: [], hasEvidence: false };
    try {
      retrieval = await retrieveRelevantFragments(parsed.data.question, { mode: assistantContext.mode });
    } catch (retrievalError) {
      console.error("RAG retrieval error", retrievalError);
    }

    const extraContext = [
      buildRagContextBlock(retrieval),
      "",
      "Contexto general de la plataforma:",
      context
    ].join("\n");

    const response = await askUrbanAssistant(
      [
        { role: "system", content: buildMigueSystemPrompt(assistantContext) },
        ...history.map((message) => ({
          role: message.role,
          content: message.content
        })),
        { role: "user", content: buildMigueUserPrompt(parsed.data.question, assistantContext, extraContext) }
      ],
      { json: true }
    );

    const { answer, cita } = parseAssistantPayload(response.answer);
    const source = buildAnswerSource(retrieval, cita);

    return NextResponse.json({ ...response, answer, source });
  } catch (error) {
    console.error("OpenRouter assistant error", error);

    return NextResponse.json(
      {
        error: "No se pudo completar el análisis",
        detail: "Intentá nuevamente o continuá con la revisión técnica manual."
      },
      { status: 502 }
    );
  }
}
