import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, ProcessingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { syncRecordLifecycle } from "@/lib/hearings/record";

const bodySchema = z.object({
  /** Notas que el operador escribio durante la audiencia. No es la transcripcion. */
  notes: z.string().max(200000).optional()
});

/**
 * Cierra una audiencia en vivo. Desde que se saco el dictado, al cerrar NO hay
 * transcripcion: lo que quedo de la audiencia es el AUDIO grabado en tramos
 * (filas de MeetingMedia) mas las notas y la ficha que cargo el operador.
 *
 * La transcripcion, los cruces con las normas y las conclusiones llegan
 * despues, cuando alguien aprieta "Analizar audio" en el detalle. Por eso la
 * audiencia se cierra con hearingStatus COMPLETED (la audiencia efectivamente
 * termino) pero con status PENDING mientras tenga audio sin transcribir: es lo
 * que el detalle lee para mostrar que falta analizarla.
 */
export async function handleFinalize(request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "No se pudieron leer las notas de la audiencia." }, { status: 400 });
  }

  try {
    // kind acotado: esta ruta cambia el estado de la audiencia y no tiene por
    // que poder apuntarse a una reunion comun.
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true, metadata: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    // Audio pendiente de transcribir: define si la audiencia queda lista o a la
    // espera del analisis.
    const pendingAudio = await prisma.meetingMedia.count({
      where: { meetingId: id, kind: "AUDIO", status: ProcessingStatus.PENDING }
    });

    const previousMetadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};

    await prisma.meeting.update({
      where: { id },
      data: {
        status: pendingAudio > 0 ? ProcessingStatus.PENDING : ProcessingStatus.READY,
        hearingStatus: "COMPLETED",
        metadata: {
          ...previousMetadata,
          // Las notas viven en metadata y NO en el expediente: no son el acta.
          // El acta la va a escribir Whisper sobre el audio, y mezclarlas seria
          // dar por transcripcion algo que el operador anoto a las apuradas.
          ...(parsed.data.notes !== undefined ? { liveNotes: parsed.data.notes } : {}),
          // El borrador ya no tiene sentido: la audiencia esta cerrada.
          draftTranscript: null,
          draftSavedAt: null,
          finalizedAt: new Date().toISOString()
        }
      }
    });
    await syncRecordLifecycle(id, "COMPLETED");

    return NextResponse.json({ ok: true, pendingAudio });
  } catch (error) {
    console.error("No se pudo finalizar la audiencia", error);
    return NextResponse.json({ error: "No se pudo finalizar la audiencia" }, { status: 500 });
  }
}
