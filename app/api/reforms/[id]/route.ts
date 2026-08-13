import { ReformStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { handleDocumentDelete } from "@/lib/normas/api/document-delete";
import { handleDocumentsList, handleDocumentsPost } from "@/lib/normas/api/documents";
import { handleReformExport } from "@/lib/normas/api/reform-export";
import { getReform, updateReform } from "@/lib/projects/data";

export const dynamic = "force-dynamic";
/** Analizar un PDF llama al modelo: no entra en el default de 10 s. */
export const maxDuration = 60;

/*
 * Todo lo que cuelga de UN codigo nuevo entra por aca, con la operacion en el
 * query param `action`. Mismo motivo que en audiencias y normas: el plan Hobby
 * de Vercel admite 12 funciones serverless y cada route.ts cuenta una.
 *
 * Cada handler vive en lib/normas/api/ con su codigo intacto.
 */
function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El paso concreto (upload-url | analyze | confirm) lo decide el propio
  // handler leyendo el cuerpo; aca solo se elige el sub-recurso.
  if (accion(request) === "documents") return handleDocumentsPost(request, id);
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (accion(request) === "export") return handleReformExport(request, id);
  if (accion(request) === "documents") return handleDocumentsList(request, id);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const reform = await getReform(id).catch(() => null);
  if (!reform) {
    return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ reform });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullish(),
  status: z.nativeEnum(ReformStatus).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "norms.edit")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const reform = await updateReform(id, parsed.data);
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
    return NextResponse.json({ reform });
  } catch (error) {
    console.error("No se pudo actualizar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo actualizar el código nuevo" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Con `?docId=` se borra ESE antecedente; sin el, el codigo nuevo entero.
  const docId = new URL(request.url).searchParams.get("docId");
  if (docId) return handleDocumentDelete(request, id, docId);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "norms.delete")) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar un código nuevo." }, { status: 403 });
  }

  try {
    // Las normas quedan con reformId en null (SetNull); no se pierden.
    await prisma.normativeReform.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo eliminar el código nuevo" }, { status: 500 });
  }
}
