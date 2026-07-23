import { HearingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing, updateHearing } from "@/lib/hearings/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { id } = await params;
  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) {
    return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ hearing });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  occurredAt: z.string().datetime().nullish(),
  modality: z.string().trim().max(80).nullish(),
  location: z.string().trim().max(200).nullish(),
  reformId: z.string().trim().min(1).max(60).nullish(),
  description: z.string().trim().max(8000).nullish(),
  hearingStatus: z.nativeEnum(HearingStatus).optional()
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
    const hearing = await updateHearing(id, {
      ...parsed.data,
      occurredAt: parsed.data.occurredAt === undefined ? undefined : parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null
    });
    if (!hearing) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudo actualizar la audiencia", error);
    return NextResponse.json({ error: "No se pudo actualizar la audiencia" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar audiencias." }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la audiencia", error);
    return NextResponse.json({ error: "No se pudo eliminar la audiencia" }, { status: 500 });
  }
}
