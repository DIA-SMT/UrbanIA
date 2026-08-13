import { MunicipalArea, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canViewInternal, getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { handleDiagnose } from "@/lib/projects/api/diagnose";
import { handleDiagnosisUpdate } from "@/lib/projects/api/diagnosis-update";
import { handleExport } from "@/lib/projects/api/export";
import { handleFormalize } from "@/lib/projects/api/formalize";
import { handleOpinionDelete } from "@/lib/projects/api/opinion-delete";
import { handleOpinionCreate, handleOpinionsList } from "@/lib/projects/api/opinions";
import { handleSupportCreate, handleSupportDelete, handleSupportGet } from "@/lib/projects/api/support";
import { createNorm, getNorm, listNorms, listProjects, updateNorm } from "@/lib/projects/data";
import { removeNormDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** Formalizar y diagnosticar llaman al modelo: no entran en el default de 10 s. */
export const maxDuration = 60;

/**
 * Fabrica de Normas: /api/projects se reinterpreta como la API de normas.
 * Una norma es un Project con reformId.
 *
 * El listado, la creacion y todas las operaciones sobre UNA norma entran por
 * esta unica ruta: el plan Hobby de Vercel admite 12 funciones serverless por
 * deploy y cada route.ts cuenta una.
 *
 * El archivo es un catch-all OPCIONAL: la misma funcion atiende /api/projects
 * (sin segmentos, la coleccion) y /api/projects/<id> (con el id en el primer
 * segmento). Ningun cliente cambio. En la coleccion, `?reformId=` lista las
 * normas de un codigo nuevo; sin el, la tabla completa.
 *
 * Se hizo con catch-all y no con un rewrite a `?id=`: un rewrite llega a la
 * funcion pero Next NO propaga el query que inyecta el destination, asi que
 * todas las llamadas /api/projects/<id> caian en la rama de la coleccion
 * (verificado en dev antes de commitear).
 *
 * Cada handler vive en lib/projects/api/ con su codigo intacto.
 */
/** Segmentos de la URL. Vacio en la coleccion, `[id]` en una norma. */
type Segments = { params: Promise<{ segments?: string[] }> };

function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

function parseEnum<T extends Record<string, string>>(value: string | null, options: T): T[keyof T] | undefined {
  if (value && (Object.values(options) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  return undefined;
}

export async function GET(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;

  if (id) {
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

  // Material de trabajo interno: normas en redaccion del codigo nuevo.
  const session = await getSessionUser();
  if (!session || !canViewInternal(session.role)) {
    return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ norms: [], isLive: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reformId = searchParams.get("reformId");
    const status = parseEnum(searchParams.get("status"), ProjectStatus);
    const area = parseEnum(searchParams.get("area"), MunicipalArea);

    const norms = reformId ? await listNorms(reformId, { status, area }) : await listProjects({ status, area });
    return NextResponse.json({ norms, isLive: true });
  } catch (error) {
    console.error("No se pudieron listar las normas", error);
    return NextResponse.json({ norms: [], isLive: false });
  }
}

const createSchema = z.object({
  reformId: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(8000),
  status: z.nativeEnum(ProjectStatus).optional(),
  areas: z.array(z.nativeEnum(MunicipalArea)).max(9).optional(),
  articleNumber: z.string().trim().max(20).nullish(),
  articleText: z.string().trim().max(40000).nullish(),
  officialNotes: z.string().trim().max(8000).nullish(),
  /**
   * Quien redacta, dentro de la cuenta institucional compartida. Obligatorio al
   * crear: sin esto todas las normas de una direccion quedan firmadas igual.
   * En el PATCH sigue siendo opcional, porque es una edicion parcial.
   */
  authorName: z.string().trim().min(1).max(120)
});

export async function POST(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (id) {
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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "La Fábrica de Normas requiere conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para redactar normas." }, { status: 401 });
  }
  if (!isStaff(session.role)) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede redactar normas." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Revisá el autor, el título y el objeto de la norma." },
      { status: 400 }
    );
  }

  try {
    const norm = await createNorm({
      ...parsed.data,
      createdById: session.userId
    });
    return NextResponse.json({ norm }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear la norma", error);
    return NextResponse.json({ error: "No se pudo crear la norma", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
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

export async function PATCH(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (!id) return NextResponse.json({ error: "Falta la norma" }, { status: 400 });

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

export async function DELETE(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (!id) return NextResponse.json({ error: "Falta la norma" }, { status: 400 });

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
