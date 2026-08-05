import { MediaKind, ProcessingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  createHearingAudioUploadUrl,
  hasSupabaseStorage,
  hearingAudioFullPath,
  removeHearingAudioParts
} from "@/lib/storage/supabase";

/**
 * Subida de los tramos de audio de una audiencia en vivo.
 *
 * Son dos pasos por tramo: firmar la subida y, una vez que el archivo esta en
 * el bucket, registrarlo. El registro va DESPUES a proposito: si la subida
 * falla no queda una fila de MeetingMedia apuntando a un archivo que no existe.
 * Al reves (archivo sin fila) no duele, porque el borrado de la audiencia
 * limpia la carpeta entera del bucket.
 *
 * El archivo nunca pasa por esta funcion: el navegador lo sube directo al
 * bucket con la URL firmada. El body de una funcion en Vercel se corta en
 * ~4,5 MB y ademas no tiene sentido pagar ese trafico dos veces.
 */

/** Solo los formatos que puede emitir MediaRecorder y acepta Whisper. */
const EXTENSIONS = ["webm", "ogg", "mp4"] as const;

/** Tope defensivo del indice: 2000 tramos de 5 min son ~166 horas de audiencia. */
const MAX_PART_INDEX = 2000;

const signSchema = z.object({
  partIndex: z.number().int().min(0).max(MAX_PART_INDEX),
  extension: z.enum(EXTENSIONS)
});

const registerSchema = z.object({
  storagePath: z.string().trim().min(1).max(400),
  partIndex: z.number().int().min(0).max(MAX_PART_INDEX),
  mimeType: z.string().trim().max(120),
  sizeBytes: z.number().int().min(0),
  offsetMs: z.number().int().min(0),
  durationMs: z.number().int().min(0)
});

/** Staff + audiencia existente. Devuelve el error listo, o el id validado. */
async function guard(id: string): Promise<NextResponse | null> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true } });
  if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
  return null;
}

/** Firma la subida de UN tramo directo al bucket privado de audio. */
export async function handleAudioPartUrl(request: Request, id: string) {
  const denied = await guard(id);
  if (denied) return denied;

  if (!hasSupabaseStorage()) {
    return NextResponse.json(
      { error: "Almacenamiento no disponible", detail: "Falta configurar Supabase Storage para guardar el audio." },
      { status: 503 }
    );
  }

  const parsed = signSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Tramo de audio mal identificado." }, { status: 400 });
  }

  try {
    const { storagePath, signedUrl } = await createHearingAudioUploadUrl({
      meetingId: id,
      partIndex: parsed.data.partIndex,
      extension: parsed.data.extension
    });
    return NextResponse.json({ storagePath, signedUrl });
  } catch (error) {
    console.error("No se pudo firmar la subida del tramo de audio", error);
    return NextResponse.json({ error: "No se pudo preparar la subida del audio" }, { status: 500 });
  }
}

/**
 * Registra un tramo ya subido. La fila nace en PENDING: las filas de
 * MeetingMedia SON la cola de trabajo de la transcripcion.
 */
export async function handleAudioPart(request: Request, id: string) {
  const denied = await guard(id);
  if (denied) return denied;

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Faltan datos del tramo de audio." }, { status: 400 });
  }
  const { storagePath, partIndex, mimeType, sizeBytes, offsetMs, durationMs } = parsed.data;

  // La ruta tiene que caer dentro de la carpeta de ESTA audiencia: el cliente
  // manda el storagePath que le devolvimos, pero no se confia en el.
  if (!storagePath.startsWith(`${id}/`)) {
    return NextResponse.json({ error: "Datos inválidos", detail: "El tramo no pertenece a esta audiencia." }, { status: 400 });
  }

  try {
    const fileName = storagePath.split("/").pop() ?? `part-${partIndex}`;
    // upsert por storagePath: un reintento que sube el mismo tramo dos veces no
    // puede dejar dos filas (y dos veces el mismo texto en la transcripcion).
    const existing = await prisma.meetingMedia.findFirst({ where: { meetingId: id, storagePath }, select: { id: true } });
    const data = {
      meetingId: id,
      kind: MediaKind.AUDIO,
      fileName,
      storagePath,
      mimeType,
      sizeBytes: BigInt(sizeBytes),
      durationSec: Math.round(durationMs / 1000),
      partIndex,
      offsetMs,
      status: ProcessingStatus.PENDING,
      errorMessage: null
    };
    const media = existing
      ? await prisma.meetingMedia.update({ where: { id: existing.id }, data })
      : await prisma.meetingMedia.create({ data });

    // Un tramo nuevo deja viejo al MP3 unido (si alguien ya lo descargo):
    // se borra el derivado y la proxima descarga lo regenera. Best-effort.
    void removeHearingAudioParts([hearingAudioFullPath(id)]).catch(() => {});

    return NextResponse.json({ ok: true, mediaId: media.id });
  } catch (error) {
    console.error("No se pudo registrar el tramo de audio", error);
    return NextResponse.json({ error: "No se pudo registrar el tramo de audio" }, { status: 500 });
  }
}
