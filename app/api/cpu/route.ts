import { NextResponse } from "next/server";
import {
  handleConversationDelete,
  handleConversationGet,
  handleConversationPatch
} from "@/lib/cpu/api/conversation";
import { handleConversationsList } from "@/lib/cpu/api/conversations";
import { handleCpuQuery } from "@/lib/cpu/api/query";

export const dynamic = "force-dynamic";

/*
 * Consulta al Codigo de Planeamiento: pregunta y conversaciones entran por esta
 * unica ruta. El plan Hobby de Vercel admite 12 funciones serverless por deploy
 * y cada route.ts cuenta una.
 *
 * Cada handler vive en lib/cpu/api/ con su codigo intacto.
 *
 * Ojo: el middleware protege `/api/cpu/:path*`, que en Next incluye tambien
 * `/api/cpu` sin segmentos. La ruta sigue exigiendo sesion de admin.
 */
function conversationId(request: Request): string | null {
  return new URL(request.url).searchParams.get("conversationId");
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get("action") ?? "";
  if (action === "query") return handleCpuQuery(request);
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function GET(request: Request) {
  // Con `?conversationId=` se pide ESA conversacion; sin el, el listado.
  const id = conversationId(request);
  return id ? handleConversationGet(request, id) : handleConversationsList(request);
}

export async function PATCH(request: Request) {
  const id = conversationId(request);
  if (!id) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });
  return handleConversationPatch(request, id);
}

export async function DELETE(request: Request) {
  const id = conversationId(request);
  if (!id) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });
  return handleConversationDelete(request, id);
}
