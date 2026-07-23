import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";

export const dynamic = "force-dynamic";

const fichaSchema = z
  .object({
    mainTopic: z.string().max(400),
    secondaryTopics: z.string().max(1000),
    relatedProposal: z.string().max(600),
    proposalSource: z.string().max(120),
    author: z.string().max(300),
    relatedArticles: z.string().max(600),
    participants: z.string().max(2000),
    institution: z.string().max(300),
    role: z.string().max(200),
    actorType: z.string().max(120),
    intervention: z.string().max(8000)
  })
  .partial();

const bodySchema = z.object({ ficha: fichaSchema });

/**
 * Edicion de la Ficha 1 (datos) desde el detalle de una audiencia ya cargada.
 * Mergea sobre metadata.ficha sin tocar el estado ni el borrador: sirve para
 * corregir la ficha de una audiencia finalizada o en curso por igual.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { metadata: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const previousMetadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};
    const previousFicha =
      previousMetadata.ficha && typeof previousMetadata.ficha === "object" && !Array.isArray(previousMetadata.ficha)
        ? (previousMetadata.ficha as Prisma.JsonObject)
        : {};

    await prisma.meeting.update({
      where: { id },
      data: { metadata: { ...previousMetadata, ficha: { ...previousFicha, ...parsed.data.ficha } } }
    });

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudo guardar la ficha de la audiencia", error);
    return NextResponse.json({ error: "No se pudo guardar la ficha" }, { status: 500 });
  }
}
