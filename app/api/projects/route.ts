import { MunicipalArea, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createNorm, listNorms, listProjects } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

/**
 * Fabrica de Normas: /api/projects se reinterpreta como la API de normas.
 * Una norma es un Project con reformId. Con ?reformId= lista las normas de un
 * codigo nuevo; sin el, lista la tabla completa (compatibilidad).
 */

function parseEnum<T extends Record<string, string>>(value: string | null, options: T): T[keyof T] | undefined {
  if (value && (Object.values(options) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  return undefined;
}

export async function GET(request: Request) {
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
  authorName: z.string().trim().max(120).nullish()
});

export async function POST(request: Request) {
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
      { error: "Datos inválidos", detail: "Revisá el título, el objeto de la norma y el código nuevo al que pertenece." },
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
