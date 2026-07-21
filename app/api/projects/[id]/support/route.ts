import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Apoyo (+1) u objecion (-1) del equipo municipal a una norma. Interno: los vecinos
 * no votan normas.
 *
 * El voto se cuenta por NOMBRE declarado, no por cuenta: las direcciones comparten
 * una cuenta institucional y con una clave por cuenta solo podia votar el primero.
 * Es una solucion provisoria y no verificable (ver la migracion
 * 20260721140000_norm_support_by_voter_name); userId se guarda igual para saber
 * desde que cuenta salio cada voto.
 */

async function readSummary(projectId: string, voterName: string | null) {
  const supports = await prisma.normSupport.findMany({
    where: { projectId },
    select: { voterName: true, value: true }
  });

  let supportCount = 0;
  let objectionCount = 0;
  let myValue: 1 | -1 | null = null;

  for (const support of supports) {
    if (support.value > 0) supportCount += 1;
    else if (support.value < 0) objectionCount += 1;
    if (voterName && support.voterName === voterName) myValue = support.value > 0 ? 1 : -1;
  }

  return {
    supportCount,
    objectionCount,
    net: supportCount - objectionCount,
    myValue,
    voters: supports.map((support) => ({ voterName: support.voterName, value: support.value }))
  };
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;
  // El servidor no sabe quien esta trabajando (vive en el sessionStorage del
  // navegador), asi que el nombre viaja como parametro para resolver myValue.
  const voterName = new URL(request.url).searchParams.get("voterName");

  try {
    return NextResponse.json(await readSummary(id, voterName));
  } catch (error) {
    console.error("No se pudo leer el apoyo de la norma", error);
    return NextResponse.json({ error: "No se pudo leer el apoyo" }, { status: 500 });
  }
}

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
  voterName: z.string().trim().min(1).max(120)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;
  const parsed = voteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Elegí tu nombre y un apoyo válido (+1 a favor o -1 en contra)." },
      { status: 400 }
    );
  }

  try {
    const norm = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!norm) {
      return NextResponse.json({ error: "Norma inexistente", detail: "La norma que intentás apoyar no existe." }, { status: 404 });
    }

    await prisma.normSupport.upsert({
      where: { projectId_voterName: { projectId: id, voterName: parsed.data.voterName } },
      create: { projectId: id, userId: gate.session.userId, voterName: parsed.data.voterName, value: parsed.data.value },
      update: { value: parsed.data.value, userId: gate.session.userId }
    });

    return NextResponse.json(await readSummary(id, parsed.data.voterName));
  } catch (error) {
    console.error("No se pudo registrar el apoyo", error);
    return NextResponse.json(
      { error: "No se pudo registrar el apoyo", detail: "Intentá nuevamente en unos segundos." },
      { status: 500 }
    );
  }
}

const removeSchema = z.object({ voterName: z.string().trim().min(1).max(120) });

/** Vuelve a neutral: la persona retira su apoyo u objecion. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { id } = await params;
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Elegí tu nombre para retirar el voto." }, { status: 400 });
  }

  try {
    // deleteMany y no delete: si no habia voto, delete tira P2025 y esto tiene que
    // ser idempotente (doble click en el boton activo).
    await prisma.normSupport.deleteMany({ where: { projectId: id, voterName: parsed.data.voterName } });
    return NextResponse.json(await readSummary(id, parsed.data.voterName));
  } catch (error) {
    console.error("No se pudo quitar el apoyo", error);
    return NextResponse.json({ error: "No se pudo quitar el apoyo" }, { status: 500 });
  }
}
