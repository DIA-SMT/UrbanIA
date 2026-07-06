import { NextResponse } from "next/server";
import { z } from "zod";
import { askUrbanAssistant, buildMigueSystemPrompt, hasOpenRouterConfig } from "@/lib/ai/openrouter";

const assistantQuerySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  context: z.string().trim().max(4000).optional()
});

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
    const context = parsed.data.context
      ? `Contexto de UrbanIA: ${parsed.data.context}`
      : "Contexto de UrbanIA: MVP con mapa urbano, propuestas, Codigo de Planeamiento, audiencias, gabinete, escenarios y participacion ciudadana.";

    const response = await askUrbanAssistant([
      { role: "system", content: buildMigueSystemPrompt() },
      { role: "user", content: `${context}\n\nConsulta: ${parsed.data.question}` }
    ]);

    return NextResponse.json(response);
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
