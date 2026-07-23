import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";

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

const bodySchema = z.object({
  transcript: z.string().max(200000).optional(),
  ficha: fichaSchema.optional()
});

/**
 * Autoguardado del borrador de una audiencia en vivo: persiste la transcripcion
 * en curso en metadata.draftTranscript sin finalizar, para poder salir y volver
 * a editarla. Los cruces ya se persisten aparte (live-match).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { metadata: true, hearingStatus: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const previousMetadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};
    const previousFicha =
      previousMetadata.ficha && typeof previousMetadata.ficha === "object" && !Array.isArray(previousMetadata.ficha)
        ? (previousMetadata.ficha as Prisma.JsonObject)
        : {};
    const savedAt = new Date().toISOString();

    await prisma.meeting.update({
      where: { id },
      data: {
        // Una audiencia con borrador guardado queda "en vivo" para poder reanudarla.
        ...(meeting.hearingStatus === "SCHEDULED" || meeting.hearingStatus === null
          ? { hearingStatus: "LIVE", status: "PROCESSING" }
          : {}),
        metadata: {
          ...previousMetadata,
          ...(parsed.data.transcript !== undefined ? { draftTranscript: parsed.data.transcript } : {}),
          ...(parsed.data.ficha !== undefined ? { ficha: { ...previousFicha, ...parsed.data.ficha } } : {}),
          draftSavedAt: savedAt
        }
      }
    });

    return NextResponse.json({ savedAt });
  } catch (error) {
    console.error("No se pudo autoguardar el borrador de la audiencia", error);
    return NextResponse.json({ error: "No se pudo autoguardar" }, { status: 500 });
  }
}
