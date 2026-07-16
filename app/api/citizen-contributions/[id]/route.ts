import { CitizenContributionStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { canAccessAdmin, readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { ASSIGNABLE_AXES } from "@/lib/citizen/contributions";

export const dynamic = "force-dynamic";

// El eje lo asigna el equipo municipal al revisar el aporte: llega sin clasificar.
const patchSchema = z
  .object({
    status: z.nativeEnum(CitizenContributionStatus).optional(),
    axis: z.string().refine((value) => ASSIGNABLE_AXES.includes(value), { message: "Eje invalido." }).optional()
  })
  .refine((value) => value.status !== undefined || value.axis !== undefined, {
    message: "Nada para actualizar."
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado o eje invalido." }, { status: 400 });
  }

  // Clasificar un aporte es trabajo municipal: requiere sesion de personal.
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Necesitas una sesion municipal para revisar aportes." }, { status: 401 });
  }

  try {
    const contribution = await prisma.citizenContribution.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        // Si una persona elige el eje, deja de ser una sugerencia de Migue.
        ...(parsed.data.axis ? { axis: parsed.data.axis, axisConfirmed: true } : {})
      },
      select: { id: true, status: true, axis: true, axisConfirmed: true }
    });

    return NextResponse.json({ contribution });
  } catch (error) {
    console.error("No se pudo actualizar el aporte ciudadano", error);
    return NextResponse.json({ error: "No pudimos actualizar el aporte ciudadano." }, { status: 500 });
  }
}

/**
 * Borra un aporte y la propuesta que se creó junto con él. Es destructivo y no hay
 * papelera: la UI pide confirmación escrita antes de llamar acá.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  const { id } = await params;
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Necesitas una sesion municipal para eliminar aportes." }, { status: 401 });
  }

  try {
    const existing = await prisma.citizenContribution.findUnique({
      where: { id },
      select: { id: true, proposalId: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Ese aporte ya no existe." }, { status: 404 });
    }

    // El aporte y su propuesta se crean juntos en una transacción; se borran igual,
    // para no dejar la propuesta huérfana en el módulo de proyectos.
    await prisma.$transaction(async (tx) => {
      await tx.citizenContribution.delete({ where: { id } });

      if (existing.proposalId) {
        await tx.proposal.delete({ where: { id: existing.proposalId } }).catch(() => {
          // La propuesta pudo haber sido borrada o convertida por otra via: el
          // aporte ya se elimino, que es lo que se pidio.
        });
      }
    });

    console.info("Aporte ciudadano eliminado.", { id, by: session.userId });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("No se pudo eliminar el aporte ciudadano", error);
    return NextResponse.json({ error: "No pudimos eliminar el aporte." }, { status: 500 });
  }
}
