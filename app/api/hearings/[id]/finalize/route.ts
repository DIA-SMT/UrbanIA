import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { saveRecordConclusions, syncRecordLifecycle } from "@/lib/hearings/record";

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

const bodySchema = z.object({
  transcript: z.string().trim().min(20).max(200000),
  conclusions: conclusionsSchema.optional()
});

/**
 * Cierra la audiencia: guarda la transcripcion final, persiste las conclusiones
 * (foto 2) ya revisadas por el operador en el HearingRecord (expediente
 * unificado; no re-corre la IA: eso lo hizo /analyze) y deja la audiencia en
 * COMPLETED. Sin conclusiones, guarda solo la transcripcion (fallback sin IA).
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
    return NextResponse.json({ error: "Transcripción inválida", detail: "La transcripción debe tener al menos 20 caracteres." }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true, metadata: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const transcript = parsed.data.transcript;
    const conclusions = parsed.data.conclusions ?? null;

    // Transcripcion final como segmento unico (la segmentacion por hablante es
    // trabajo de la ingesta batch con Whisper).
    await prisma.transcriptSegment.deleteMany({ where: { meetingId: id } });
    await prisma.transcriptSegment.create({
      data: { meetingId: id, startMs: 0, endMs: 0, content: transcript, speakerLabel: "Audiencia en vivo" }
    });

    // Conclusiones revisadas por el humano: al HearingRecord (columnas firmadas
    // que re-correr la IA no pisa). MeetingAnalysis queda solo para salidas IA.
    if (conclusions) {
      await saveRecordConclusions(id, conclusions);
    }

    const previousMetadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};

    await prisma.meeting.update({
      where: { id },
      data: {
        status: "READY",
        hearingStatus: "COMPLETED",
        description: conclusions?.summary || undefined,
        // El borrador ya quedo como TranscriptSegment: se limpia de metadata.
        metadata: { ...previousMetadata, draftTranscript: null, draftSavedAt: null, finalizedAt: new Date().toISOString() }
      }
    });
    await syncRecordLifecycle(id, "COMPLETED");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo finalizar la audiencia", error);
    return NextResponse.json({ error: "No se pudo finalizar la audiencia" }, { status: 500 });
  }
}
