import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { saveRecordConclusions } from "@/lib/hearings/record";

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
 * Persiste en el HearingRecord (expediente unificado): son las conclusiones
 * firmadas por una persona, en columnas propias que re-correr la IA no pisa.
 * A diferencia de /finalize, no cierra la audiencia.
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

    await saveRecordConclusions(id, parsed.data.conclusions);

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudieron guardar las conclusiones de la audiencia", error);
    return NextResponse.json({ error: "No se pudieron guardar las conclusiones" }, { status: 500 });
  }
}
