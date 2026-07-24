import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeHearingTranscript, draftToConclusions } from "@/lib/hearings/analyze";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  transcript: z.string().trim().min(20).max(200000)
});

/**
 * Paso de cierre - Migue precarga: analiza la transcripcion y devuelve las
 * conclusiones (foto 2) para que el operador las revise/edite antes de guardar.
 * Persiste los participantes detectados (no editables en la ficha 2). No cierra
 * la audiencia: eso lo hace /finalize con las conclusiones ya revisadas.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      { error: "IA no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Transcripción inválida", detail: "Dictá o escribí un poco más antes de cerrar." }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const { draft } = await analyzeHearingTranscript(parsed.data.transcript, { title: meeting.title });

    // Participantes detectados: se re-crean desde el analisis mas reciente, en
    // transaccion para no dejar la audiencia sin participantes si falla el alta.
    if (draft.participants.length) {
      await prisma.$transaction([
        prisma.meetingParticipant.deleteMany({ where: { meetingId: id } }),
        prisma.meetingParticipant.createMany({
          data: draft.participants.map((participant) => ({
            meetingId: id,
            displayName: participant.name,
            role: participant.role,
            metadata: { institution: participant.institution, actorType: participant.actorType, intervention: participant.intervention } as Prisma.InputJsonValue
          }))
        })
      ]);
    }

    return NextResponse.json({ conclusions: draftToConclusions(draft) });
  } catch (error) {
    console.error("No se pudo analizar la audiencia para el cierre", error);
    return NextResponse.json({ error: "No se pudo analizar la audiencia", detail: "Intentá nuevamente o revisá la transcripción." }, { status: 502 });
  }
}
