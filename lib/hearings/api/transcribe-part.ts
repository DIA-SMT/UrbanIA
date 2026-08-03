import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser, isStaff } from "@/lib/auth/api";
import { transcribeAudioFile } from "@/lib/ai/transcription";
import { prisma } from "@/lib/db/prisma";
import { downloadHearingAudioPart } from "@/lib/storage/supabase";

/**
 * Transcribe UN tramo de la grabacion de una audiencia.
 *
 * Por que de a un tramo y no toda la grabacion de una: transcribir dos horas
 * lleva varios minutos y una funcion de Vercel se corta a los 300 s. Un tramo
 * de 5 minutos tarda alrededor de un minuto, asi que entra con aire. El
 * navegador llama a esta ruta una vez por tramo y va mostrando el progreso.
 *
 * Todo el pipeline es HTTP contra OpenRouter: NO hace falta ffmpeg ni ningun
 * binario en la funcion, porque el audio ya llega cortado desde el navegador.
 * Esa es la razon de fondo por la que la grabacion se guarda en tramos.
 */

const bodySchema = z.object({ mediaId: z.string().trim().min(1).max(60) });

export async function handleTranscribePart(request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Falta identificar el tramo." }, { status: 400 });
  }

  const media = await prisma.meetingMedia.findFirst({
    where: { id: parsed.data.mediaId, meetingId: id, kind: "AUDIO" },
    select: { id: true, storagePath: true, fileName: true, offsetMs: true, durationSec: true, status: true }
  });
  if (!media) return NextResponse.json({ error: "Tramo de audio no encontrado" }, { status: 404 });

  // Toma atomica del tramo: un updateMany condicionado evita que dos llamadas
  // en paralelo (doble click, dos pestanas) transcriban el mismo tramo y
  // dupliquen su texto en el acta.
  const claimed = await prisma.meetingMedia.updateMany({
    where: { id: media.id, status: { in: ["PENDING", "ERROR"] } },
    data: { status: "PROCESSING", errorMessage: null }
  });
  if (claimed.count === 0) {
    return NextResponse.json({ ok: true, skipped: true, status: media.status });
  }

  try {
    const bytes = await downloadHearingAudioPart(media.storagePath);
    const segments = await transcribeAudioFile({
      bytes,
      fileName: media.fileName,
      offsetMs: media.offsetMs ?? 0,
      fallbackDurationMs: (media.durationSec ?? 0) * 1000
    });

    // Idempotencia: se limpia lo que este tramo pueda haber dejado en un intento
    // anterior (por ejemplo si guardo el texto y despues fallo al marcarse como
    // listo). El limite superior es el arranque del tramo SIGUIENTE y no
    // offset+duracion, porque los tramos se solapan a proposito y ese solape
    // se llevaria puestos los primeros segundos del vecino ya transcripto.
    const next = await prisma.meetingMedia.findFirst({
      where: { meetingId: id, kind: "AUDIO", offsetMs: { gt: media.offsetMs ?? 0 } },
      orderBy: { offsetMs: "asc" },
      select: { offsetMs: true }
    });
    const from = media.offsetMs ?? 0;
    const to = next?.offsetMs ?? from + (media.durationSec ?? 0) * 1000 + 1;
    await prisma.transcriptSegment.deleteMany({ where: { meetingId: id, startMs: { gte: from, lt: to } } });

    if (segments.length) {
      await prisma.transcriptSegment.createMany({
        data: segments.map((segment) => ({
          meetingId: id,
          startMs: segment.startMs,
          endMs: segment.endMs,
          content: segment.text,
          // La grabacion en vivo es un solo canal de sala: no hay separacion de
          // voces. La etiqueta lo dice en vez de inventar oradores.
          speakerLabel: "Audiencia en vivo"
        }))
      });
    }

    await prisma.meetingMedia.update({ where: { id: media.id }, data: { status: "READY", errorMessage: null } });
    return NextResponse.json({ ok: true, segments: segments.length });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No se pudo transcribir el tramo.";
    // El tramo vuelve a quedar reintentable, con el motivo a la vista: sin esto
    // un fallo lo dejaba en PROCESSING para siempre y trababa el analisis.
    await prisma.meetingMedia
      .update({ where: { id: media.id }, data: { status: "ERROR", errorMessage: detail.slice(0, 500) } })
      .catch(() => {});
    console.error(`No se pudo transcribir el tramo ${media.fileName}`, error);
    return NextResponse.json({ error: "No se pudo transcribir el tramo", detail }, { status: 500 });
  }
}
