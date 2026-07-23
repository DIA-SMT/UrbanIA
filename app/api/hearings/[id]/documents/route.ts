import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { ensureHearingRecord } from "@/lib/hearings/record";
import { hasSupabaseStorage, uploadHearingDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".odt", ".jpg", ".jpeg", ".png", ".webp", ".xls", ".xlsx", ".csv"];

/**
 * Sube un documento adjunto a una audiencia: guarda el archivo real en Supabase
 * Storage y lo registra como HearingDocument del expediente (link, peso, tipo,
 * quien lo subio). Devuelve la audiencia actualizada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  if (!hasSupabaseStorage()) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado", detail: "Falta configurar Supabase Storage (URL y key) para subir documentos." },
      { status: 503 }
    );
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    file = null;
  }
  if (!file) {
    return NextResponse.json({ error: "Archivo faltante", detail: "Adjuntá un documento." }, { status: 400 });
  }

  const fileName = file.name || "documento";
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      { error: "Formato no soportado", detail: `"${fileName}" no es un formato aceptado (PDF, Word, imágenes, planillas o texto).` },
      { status: 415 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = `${(file.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
    return NextResponse.json(
      { error: "Archivo demasiado pesado", detail: `"${fileName}" pesa ${sizeMb} y el límite es 15 MB.` },
      { status: 413 }
    );
  }

  try {
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadHearingDocument({
      meetingId: id,
      fileName,
      contentType: file.type || "application/octet-stream",
      bytes
    });

    const recordId = await ensureHearingRecord(id);
    const uploader = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });

    await prisma.hearingDocument.create({
      data: {
        hearingRecordId: recordId,
        name: fileName,
        type: file.type || extension.replace(".", "").toUpperCase(),
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        sizeBytes: file.size,
        uploadedBy: uploader?.name ?? null
      }
    });

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing }, { status: 201 });
  } catch (error) {
    console.error("No se pudo subir el documento de la audiencia", error);
    return NextResponse.json({ error: "No se pudo subir el documento", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}
