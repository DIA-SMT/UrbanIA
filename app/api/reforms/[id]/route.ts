import { ReformStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getReform, updateReform } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { id } = await params;
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
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar un código nuevo." }, { status: 403 });
  }

  const { id } = await params;
  try {
    // Las normas quedan con reformId en null (SetNull); no se pierden.
    await prisma.normativeReform.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo eliminar el código nuevo" }, { status: 500 });
  }
}
