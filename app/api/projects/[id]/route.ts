import { MunicipalArea, ProjectStage, ProjectStatus, ProposalSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getProject, updateProject } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).max(8000).optional(),
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  try {
    const project = await updateProject(id, parsed.data);
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    console.error("No se pudo actualizar el proyecto", error);
    return NextResponse.json({ error: "No se pudo actualizar el proyecto" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar proyectos." }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.project.delete({ where: { id } });
    // Los anclajes normativos usan sourceType/sourceId (no FK): se limpian aparte.
    await prisma.normativeLink.deleteMany({ where: { sourceType: "project", sourceId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el proyecto", error);
    return NextResponse.json({ error: "No se pudo eliminar el proyecto" }, { status: 500 });
  }
}
