import { NextResponse } from "next/server";

import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { matchFullTranscript } from "@/lib/hearings/batch-match";

/**
 * Cierre del analisis de una audiencia grabada, una vez transcriptos todos sus
 * tramos: cruces contra las mininormas, resumen estructurado, participantes,
 * estado final e indexado a la base de conocimiento de Migue.
 *
 * No reimplementa nada: arma los chunks a partir de los TranscriptSegment ya
 * guardados y se los pasa a matchFullTranscript, el mismo camino que corre la
 * ingesta batch (el que quedo verificado end-to-end con una audiencia real de
 * 68 minutos). Reescribe los segmentos con el mismo contenido, que es inocuo y
 * ademas deja el acta consistente si algun tramo se re-transcribio.
 */
export async function handleAnalyzeRecording(_request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "ai.execute")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const meeting = await prisma.meeting.findFirst({
    where: { id, kind: "PUBLIC_HEARING" },
    select: { id: true, reformId: true }
  });
  if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

  // No se analiza a medias: un acta incompleta que queda marcada como cerrada
  // es peor que una que todavia dice que le falta.
  const unfinished = await prisma.meetingMedia.count({
    where: { meetingId: id, kind: "AUDIO", status: { in: ["PENDING", "PROCESSING", "ERROR"] } }
  });
  if (unfinished > 0) {
    return NextResponse.json(
      {
        error: "Faltan tramos por transcribir",
        detail: `Quedan ${unfinished} ${unfinished === 1 ? "tramo" : "tramos"} de audio sin transcribir.`
      },
      { status: 409 }
    );
  }

  const segments = await prisma.transcriptSegment.findMany({
    where: { meetingId: id },
    orderBy: { startMs: "asc" },
    // speakerLabel incluido a proposito: matchFullTranscript reescribe los
    // segmentos y, sin el, pisaria "Hablante 1/2/3" con la etiqueta generica,
    // perdiendo la separacion de voces que acaba de hacer la transcripcion.
    select: { startMs: true, content: true, speakerLabel: true }
  });
  if (!segments.length) {
    return NextResponse.json(
      { error: "No hay transcripción", detail: "El audio no produjo texto para analizar." },
      { status: 400 }
    );
  }

  try {
    const result = await matchFullTranscript({
      meetingId: id,
      // Sin codigo nuevo asociado (audiencia de tema libre) el catalogo sale
      // vacio y simplemente no hay cruces: el resto del analisis corre igual.
      reformId: meeting.reformId ?? "",
      chunks: segments.map((segment) => ({ text: segment.content, atMs: segment.startMs, speaker: segment.speakerLabel })),
      speakerLabel: "Audiencia en vivo"
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("No se pudo analizar la grabación de la audiencia", error);
    return NextResponse.json(
      { error: "No se pudo analizar la audiencia", detail: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
