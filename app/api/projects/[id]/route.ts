import { MunicipalArea, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { handleDiagnose } from "@/lib/projects/api/diagnose";
import { handleDiagnosisUpdate } from "@/lib/projects/api/diagnosis-update";
import { handleExport } from "@/lib/projects/api/export";
import { handleFormalize } from "@/lib/projects/api/formalize";
import { handleOpinionDelete } from "@/lib/projects/api/opinion-delete";
import { handleOpinionCreate, handleOpinionsList } from "@/lib/projects/api/opinions";
import { handleSupportCreate, handleSupportDelete, handleSupportGet } from "@/lib/projects/api/support";
import { getNorm, updateNorm } from "@/lib/projects/data";
import { removeNormDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** Formalizar y diagnosticar llaman al modelo: no entran en el default de 10 s. */
export const maxDuration = 60;

/*
 * Todas las operaciones sobre UNA norma entran por esta ruta, con la operacion
 * en el query param `action`. Mismo motivo que en audiencias: el plan Hobby de
 * Vercel admite 12 funciones serverless por deploy y cada route.ts cuenta una.
 *
 * Cada handler vive en lib/projects/api/ con su codigo intacto.
 */
function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  switch (accion(request)) {
    case "diagnose":
      return handleDiagnose(request, id);
    case "formalize":
      return handleFormalize(request, id);
    case "opinions":
      return handleOpinionCreate(request, id);
    case "support":
      return handleSupportCreate(request, id);
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Sub-recursos de solo lectura; sin action, el detalle de la norma.
  if (accion(request) === "export") return handleExport(request, id);
  if (accion(request) === "opinions") return handleOpinionsList(request, id);
  if (accion(request) === "support") return handleSupportGet(request, id);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const norm = await getNorm(id);
  if (!norm) {
    return NextResponse.json({ error: "Norma no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ norm });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).max(8000).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  areas: z.array(z.nativeEnum(MunicipalArea)).max(9).optional(),
  articleNumber: z.string().trim().max(20).nullish(),
  articleText: z.string().trim().max(40000).nullish(),
  officialNotes: z.string().trim().max(8000).nullish(),
  authorName: z.string().trim().max(120).nullish(),
  reformId: z.string().trim().min(1).max(60).nullish()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Con `?diagnosisId=` se edita ESE diagnostico; sin el, la norma.
  const diagnosisId = new URL(request.url).searchParams.get("diagnosisId");
  if (diagnosisId) return handleDiagnosisUpdate(request, id, diagnosisId);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const norm = await updateNorm(id, parsed.data);
    if (!norm) return NextResponse.json({ error: "Norma no encontrada" }, { status: 404 });
    return NextResponse.json({ norm });
  } catch (error) {
    console.error("No se pudo actualizar la norma", error);
    return NextResponse.json({ error: "No se pudo actualizar la norma" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Sub-recursos: quitar una opinion o el apoyo. Sin eso, borrar la norma
  // entera, que exige ADMIN.
  const opinionId = new URL(request.url).searchParams.get("opinionId");
  if (opinionId) return handleOpinionDelete(request, id, opinionId);
  if (accion(request) === "support") return handleSupportDelete(request, id);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar normas." }, { status: 403 });
  }

  try {
    // Archivos del bucket que quedarian huerfanos al borrar la norma. Un mismo
    // PDF puede respaldar VARIAS normas (y ademas seguir listado como
    // antecedente de la reforma), asi que el objeto solo se borra si nadie mas
    // lo apunta. Sin esto, borrar una norma se lleva el PDF de las otras.
    const attachments = await prisma.projectAttachment.findMany({
      where: { projectId: id, storagePath: { not: null } },
      select: { storagePath: true }
    });
    const paths = [...new Set(attachments.map((a) => a.storagePath).filter((p): p is string => Boolean(p)))];

    for (const storagePath of paths) {
      const [otrasNormas, comoAntecedente] = await Promise.all([
        prisma.projectAttachment.count({ where: { storagePath, projectId: { not: id } } }),
        prisma.reformDocument.count({ where: { storagePath } })
      ]);
      if (otrasNormas > 0 || comoAntecedente > 0) continue;

      // Best-effort: que el bucket falle no puede impedir borrar la norma.
      await removeNormDocument(storagePath).catch((error) =>
        console.error("No se pudo borrar el objeto del bucket", error)
      );
    }

    await prisma.project.delete({ where: { id } });
    // Los anclajes normativos usan sourceType/sourceId (no FK): se limpian aparte.
    await prisma.normativeLink.deleteMany({ where: { sourceType: "project", sourceId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la norma", error);
    return NextResponse.json({ error: "No se pudo eliminar la norma" }, { status: 500 });
  }
}
