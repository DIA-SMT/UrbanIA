import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";

export const dynamic = "force-dynamic";

const conclusionsSchema = z.object({
  summary: z.string().max(8000),
  agreements: z.string().max(8000),
  disagreements: z.string().max(8000),
  nextSteps: z.string().max(8000),
  technicalRecommendations: z.string().max(8000),
  decisions: z.string().max(8000),
  proposalStatusAfter: z.string().max(400),
  observedTopics: z.string().max(2000),
  importance: z.string().max(40),
  technicalObservation: z.string().max(8000),
  citizenObservation: z.string().max(8000)
});

const bodySchema = z.object({ conclusions: conclusionsSchema });

/**
 * Edicion de la Ficha 2 (conclusiones y temas observados) desde el detalle.
 * Guarda una nueva version de MeetingAnalysis "human-review" (el detalle lee la
 * ultima), sin tocar la transcripcion ni el estado de la audiencia. A diferencia
 * de /finalize, no cierra la audiencia: solo corrige/actualiza las conclusiones.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const conclusions = parsed.data.conclusions;
    const lastVersion = await prisma.meetingAnalysis.findFirst({
      where: { meetingId: id },
      orderBy: { version: "desc" },
      select: { version: true }
    });

    await prisma.meetingAnalysis.create({
      data: {
        meetingId: id,
        model: "human-review",
        version: (lastVersion?.version ?? 0) + 1,
        summary: conclusions.summary,
        conclusions: [conclusions] as Prisma.InputJsonValue,
        topics: conclusions.observedTopics
          .split(",")
          .map((topic) => topic.trim())
          .filter(Boolean) as Prisma.InputJsonValue,
        citations: [] as Prisma.InputJsonValue
      }
    });

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudieron guardar las conclusiones de la audiencia", error);
    return NextResponse.json({ error: "No se pudieron guardar las conclusiones" }, { status: 500 });
  }
}
