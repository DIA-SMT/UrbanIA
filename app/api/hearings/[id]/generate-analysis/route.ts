import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeHearingTranscript } from "@/lib/hearings/analyze";
import { getHearing } from "@/lib/hearings/data";

export const dynamic = "force-dynamic";
/** El analisis de una audiencia larga puede tardar; no es una request rapida. */
export const maxDuration = 120;

/**
 * Genera (o regenera) el resumen estructurado de una audiencia YA transcripta.
 *
 * Existe porque el analisis es el ULTIMO paso de la ingesta batch: si falla
 * —tipicamente por quedarse sin credito despues de pagar la transcripcion y el
 * macheo— la audiencia queda COMPLETED con su transcripcion y sus cruces, pero
 * sin resumen, sin conclusiones y sin participantes, y no habia forma de
 * recuperarlo salvo re-ingestar todo y pagar la transcripcion de nuevo.
 *
 * Trabaja sobre los TranscriptSegment ya persistidos: no vuelve a descargar ni
 * a transcribir nada.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id, kind: "PUBLIC_HEARING" },
      select: {
        title: true,
        metadata: true,
        transcriptSegments: { orderBy: { startMs: "asc" }, select: { content: true } }
      }
    });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const transcript = meeting.transcriptSegments
      .map((segment) => segment.content.trim())
      .filter(Boolean)
      .join(" ");
    if (transcript.length < 20) {
      return NextResponse.json(
        { error: "Sin transcripción", detail: "Esta audiencia todavía no tiene transcripción para analizar." },
        { status: 422 }
      );
    }

    const { draft, model, provider } = await analyzeHearingTranscript(transcript, { title: meeting.title });

    const lastVersion = await prisma.meetingAnalysis.findFirst({
      where: { meetingId: id },
      orderBy: { version: "desc" },
      select: { version: true }
    });

    await prisma.meetingAnalysis.create({
      data: {
        meetingId: id,
        model,
        provider,
        version: (lastVersion?.version ?? 0) + 1,
        summary: draft.summary,
        conclusions: [draft.conclusions] as Prisma.InputJsonValue,
        topics: [draft.mainTopic, ...draft.secondaryTopics] as Prisma.InputJsonValue,
        citations: draft.relatedArticles as Prisma.InputJsonValue
      }
    });

    if (draft.participants.length) {
      await prisma.$transaction([
        prisma.meetingParticipant.deleteMany({ where: { meetingId: id } }),
        prisma.meetingParticipant.createMany({
          data: draft.participants.map((participant) => ({
            meetingId: id,
            displayName: participant.name,
            role: participant.role,
            metadata: {
              institution: participant.institution,
              actorType: participant.actorType,
              intervention: participant.intervention
            } as Prisma.InputJsonValue
          }))
        })
      ]);
    }

    // El aviso de "quedo sin resumen" ya no aplica: se limpia.
    const metadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};
    await prisma.meeting.update({
      where: { id },
      data: { description: draft.summary, metadata: { ...metadata, ingestWarning: null } }
    });

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudo generar el analisis de la audiencia", error);
    return NextResponse.json(
      { error: "No se pudo generar el análisis", detail: error instanceof Error ? error.message : undefined },
      { status: 502 }
    );
  }
}
