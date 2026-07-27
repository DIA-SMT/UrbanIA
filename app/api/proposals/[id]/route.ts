import { ProposalStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { canAccessAdmin, readSessionToken, sessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.nativeEnum(ProposalStatus)
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  // Aprobar o rechazar la propuesta de un vecino es una decision municipal:
  // mismo criterio que el PATCH de /api/citizen-contributions/[id]. Se valida
  // ANTES de mirar el body para no filtrarle el esquema a un anonimo.
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Necesitas una sesion municipal para cambiar el estado de una propuesta." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
  }

  try {
    const proposal = await prisma.proposal.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, status: true }
    });

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error("No se pudo actualizar la propuesta", error);
    return NextResponse.json({ error: "No pudimos actualizar la propuesta." }, { status: 500 });
  }
}
