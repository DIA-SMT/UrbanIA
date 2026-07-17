import { MunicipalArea, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getNorm, updateNorm } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { id } = await params;
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
  reformId: z.string().trim().min(1).max(60).nullish()
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar normas." }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.project.delete({ where: { id } });
    // Los anclajes normativos usan sourceType/sourceId (no FK): se limpian aparte.
    await prisma.normativeLink.deleteMany({ where: { sourceType: "project", sourceId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la norma", error);
    return NextResponse.json({ error: "No se pudo eliminar la norma" }, { status: 500 });
  }
}
