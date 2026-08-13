import { NextResponse } from "next/server";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
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
 * El guard de abajo corre en CADA verbo. Antes esta ruta decia "sigue exigiendo
 * sesion de admin" apoyandose solo en el middleware, y era la unica proteccion
 * que tenia: ninguno de los handlers de lib/cpu/api/ verifica sesion
 * (resolveCpuOwner identifica al dueño de la conversacion, no autoriza). Como el
 * RAG de esta ruta alcanza actas y transcripciones de audiencia, la ruta tiene
 * que defenderse sola y no depender de una barrera que vive en otro archivo.
 */
function conversationId(request: Request): string | null {
  return new URL(request.url).searchParams.get("conversationId");
}

/** null si puede pasar; la respuesta de rechazo si no. */
async function sinAccesoInterno() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      {
        error: "Sesion requerida",
        detail: "Ingresá con tu cuenta municipal para usar la consulta normativa."
      },
      { status: 401 }
    );
  }
  if (!canViewInternal(session)) {
    return NextResponse.json(
      {
        error: "Sin permisos",
        detail: "Tu cuenta no tiene acceso al sistema interno."
      },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(request: Request) {
  const rechazo = await sinAccesoInterno();
  if (rechazo) return rechazo;

  const action = new URL(request.url).searchParams.get("action") ?? "";
  if (action === "query") return handleCpuQuery(request);
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function GET(request: Request) {
  const rechazo = await sinAccesoInterno();
  if (rechazo) return rechazo;

  // Con `?conversationId=` se pide ESA conversacion; sin el, el listado.
  const id = conversationId(request);
  return id ? handleConversationGet(request, id) : handleConversationsList(request);
}

export async function PATCH(request: Request) {
  const rechazo = await sinAccesoInterno();
  if (rechazo) return rechazo;

  const id = conversationId(request);
  if (!id) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });
  return handleConversationPatch(request, id);
}

export async function DELETE(request: Request) {
  const rechazo = await sinAccesoInterno();
  if (rechazo) return rechazo;

  const id = conversationId(request);
  if (!id) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });
  return handleConversationDelete(request, id);
}
