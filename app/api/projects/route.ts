import { MunicipalArea, ProjectStage, ProjectStatus, ProposalSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createProject, listProjects, type ProjectFilters } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

function parseEnum<T extends Record<string, string>>(value: string | null, options: T): T[keyof T] | undefined {
  if (value && (Object.values(options) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  return undefined;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ projects: [], isLive: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters: ProjectFilters = {
      status: parseEnum(searchParams.get("status"), ProjectStatus),
      stage: parseEnum(searchParams.get("stage"), ProjectStage),
      area: parseEnum(searchParams.get("area"), MunicipalArea)
    };
    const projects = await listProjects(filters);
    return NextResponse.json({ projects, isLive: true });
  } catch (error) {
    console.error("No se pudo listar los proyectos", error);
    return NextResponse.json({ projects: [], isLive: false });
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(8000),
  source: z.nativeEnum(ProposalSource).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  stage: z.nativeEnum(ProjectStage).optional(),
  areas: z.array(z.nativeEnum(MunicipalArea)).max(9).optional(),
  requiresEIA: z.boolean().optional(),
  eiaNotes: z.string().trim().max(4000).nullish(),
  proposalId: z.string().trim().min(1).max(60).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  addressLabel: z.string().trim().max(300).nullish(),
  districtId: z.string().trim().min(1).max(60).nullish(),
  officialNotes: z.string().trim().max(8000).nullish()
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible", detail: "El modulo de proyectos requiere conexion a la base." }, { status: 503 });
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "No autenticado", detail: "Inicia sesion para crear proyectos." }, { status: 401 });
  }
  if (!isStaff(session.role)) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede crear proyectos." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", detail: "Revisa el titulo y la descripcion del proyecto." }, { status: 400 });
  }

  try {
    const project = await createProject({
      ...parsed.data,
      source: parsed.data.source ?? ProposalSource.TECHNICAL_TEAM,
      createdById: session.userId
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear el proyecto", error);
    return NextResponse.json({ error: "No se pudo crear el proyecto", detail: "Intenta nuevamente en unos segundos." }, { status: 500 });
  }
}
