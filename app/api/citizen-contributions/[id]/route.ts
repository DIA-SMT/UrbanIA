import { CitizenContributionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.nativeEnum(CitizenContributionStatus)
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
  }

  try {
    const contribution = await prisma.citizenContribution.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, status: true }
    });

    return NextResponse.json({ contribution });
  } catch (error) {
    console.error("No se pudo actualizar el aporte ciudadano", error);
    return NextResponse.json({ error: "No pudimos actualizar el aporte ciudadano." }, { status: 500 });
  }
}
