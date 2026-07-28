import { NextResponse } from "next/server";
import { handleAssistantFeedback } from "@/lib/ai/api/assistant-feedback";
import { handleAssistantQuery } from "@/lib/ai/api/assistant-query";

/*
 * Migue: preguntar y calificar la respuesta entran por esta unica ruta. El plan
 * Hobby de Vercel admite 12 funciones serverless por deploy y cada route.ts
 * cuenta una.
 *
 * Cada handler vive en lib/ai/api/ con su codigo intacto.
 */
export async function POST(request: Request) {
  switch (new URL(request.url).searchParams.get("action") ?? "") {
    case "query":
      return handleAssistantQuery(request);
    case "feedback":
      return handleAssistantFeedback(request);
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}
