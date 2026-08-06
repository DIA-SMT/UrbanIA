import { NextResponse } from "next/server";

import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { buildFullHearingAudio } from "@/lib/hearings/audio-export";
import { createHearingAudioDownloadUrl, hearingAudioFullExists, hearingAudioFullPath } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** Generar el MP3 de una audiencia larga puede llevar minutos la primera vez. */
export const maxDuration = 300;

/*
 * Descarga del audio completo de una audiencia (staff): une los tramos de la
 * grabacion en un MP3 y devuelve una URL firmada que vence.
 *
 * El MP3 se genera UNA vez y queda en el bucket como derivado; las descargas
 * siguientes son instantaneas. Si la audiencia se retoma y aparece un tramo
 * nuevo, el registro del tramo borra el derivado y la proxima descarga lo
 * regenera (ver handleAudioPart).
 *
 * Ruta PROPIA y no otra ?action= de /api/hearings/[id] a proposito: es la
 * unica que necesita el binario de ffmpeg (~80 MB), y la funcion general ya
 * carga Chromium y onnx — sumarle ffmpeg arriesga el limite de tamano del
 * bundle. El costo es una funcion serverless mas (15 en total).
 */
export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const meeting = await prisma.meeting.findFirst({
    where: { id, kind: "PUBLIC_HEARING" },
    select: { id: true, title: true, occurredAt: true }
  });
  if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

  // Nombre con el que se guarda el archivo en la maquina de quien descarga.
  const fecha = (meeting.occurredAt ?? new Date()).toISOString().slice(0, 10);
  const safeTitle = meeting.title.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.\-]/g, "").trim().slice(0, 60) || "audiencia";
  const downloadName = `${fecha} ${safeTitle}.mp3`;

  try {
    let cached = await hearingAudioFullExists(id);
    if (!cached) {
      const built = await buildFullHearingAudio(id);
      if (!built) {
        return NextResponse.json(
          { error: "Sin grabación", detail: "Esta audiencia no tiene audio grabado para descargar." },
          { status: 404 }
        );
      }
      cached = false;
    }

    const url = await createHearingAudioDownloadUrl(hearingAudioFullPath(id), 60 * 60, downloadName);
    return NextResponse.json({ url, cached });
  } catch (error) {
    console.error("No se pudo preparar el audio completo de la audiencia", error);
    return NextResponse.json(
      { error: "No se pudo preparar el audio", detail: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
