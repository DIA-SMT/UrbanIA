import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Apoyo (+1) u objecion (-1) del equipo municipal a una norma. Interno: los vecinos
 * no votan normas. El unique (projectId, userId) del schema hace que cambiar de
 * opinion actualice el mismo registro en vez de acumular votos.
 */

async function readSummary(projectId: string, viewerId: string) {
  const supports = await prisma.normSupport.findMany({
    where: { projectId },
    select: { userId: true, value: true }
  });

  let supportCount = 0;
  let objectionCount = 0;
  let myValue: 1 | -1 | null = null;

  for (const support of supports) {
    if (support.value > 0) supportCount += 1;
    else if (support.value < 0) objectionCount += 1;
    if (support.userId === viewerId) myValue = support.value > 0 ? 1 : -1;
  }

  return { supportCount, objectionCount, net: supportCount - objectionCount, myValue };
}

async function guard() {
  if (!process.env.DATABASE_URL) {
    return { error: NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 }) };
  }
  const session = await getSessionUser();
  if (!session) {
    return { error: NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para apoyar una norma." }, { status: 401 }) };
  }
  if (!isStaff(session.role)) {
    return {
      error: NextResponse.json(
        { error: "Sin permisos", detail: "Solo el equipo municipal puede apoyar u objetar una norma." },
        { status: 403 }
      )
    };
  }
  return { session };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;

  try {
    return NextResponse.json(await readSummary(id, gate.session.userId));
  } catch (error) {
    console.error("No se pudo leer el apoyo de la norma", error);
    return NextResponse.json({ error: "No se pudo leer el apoyo" }, { status: 500 });
  }
}

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;
  const parsed = voteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "El apoyo solo admite +1 (a favor) o -1 (en contra)." },
      { status: 400 }
    );
  }

  try {
    const norm = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!norm) {
      return NextResponse.json({ error: "Norma inexistente", detail: "La norma que intentás apoyar no existe." }, { status: 404 });
    }

    await prisma.normSupport.upsert({
      where: { projectId_userId: { projectId: id, userId: gate.session.userId } },
      create: { projectId: id, userId: gate.session.userId, value: parsed.data.value },
      update: { value: parsed.data.value }
    });

    return NextResponse.json(await readSummary(id, gate.session.userId));
  } catch (error) {
    console.error("No se pudo registrar el apoyo", error);
    return NextResponse.json(
      { error: "No se pudo registrar el apoyo", detail: "Intentá nuevamente en unos segundos." },
      { status: 500 }
    );
  }
}

/** Vuelve a neutral: el usuario retira su apoyo u objecion. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;

  try {
    // deleteMany y no delete: si no habia voto, delete tira P2025 y esto tiene que
    // ser idempotente (doble click en el boton activo).
    await prisma.normSupport.deleteMany({ where: { projectId: id, userId: gate.session.userId } });
    return NextResponse.json(await readSummary(id, gate.session.userId));
  } catch (error) {
    console.error("No se pudo quitar el apoyo", error);
    return NextResponse.json({ error: "No se pudo quitar el apoyo" }, { status: 500 });
  }
}
