import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { attachHearingDocument } from "@/lib/hearings/attach-document";
import { hasSupabaseStorage } from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { ingestHearingReport } from "@/lib/knowledge/ingest-hearing-report";

/** Formatos con texto que se pueden indexar para el conocimiento de Migue. */
const INGESTABLE_EXTENSIONS = [".pdf", ".txt"];


const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".odt", ".jpg", ".jpeg", ".png", ".webp", ".xls", ".xlsx", ".csv"];

/**
 * Sube un documento adjunto a una audiencia: guarda el archivo real en Supabase
 * Storage y lo registra como HearingDocument del expediente (link, peso, tipo,
 * quien lo subio). Devuelve la audiencia actualizada.
 */
export async function handleDocumentUpload(request: Request, id: string) {
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
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true, title: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploader = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });

    const { documentId, url } = await attachHearingDocument({
      meetingId: id,
      fileName,
      contentType: file.type || "application/octet-stream",
      bytes,
      fileSize: file.size,
      uploadedByName: uploader?.name ?? null
    });

    // El informe se indexa para el conocimiento de Migue DESPUES de responder
    // (after): extraer texto + embeber tarda segundos y no debe demorar la subida.
    // Solo formatos con texto; una falla aca no afecta al documento ya guardado.
    if (INGESTABLE_EXTENSIONS.includes(extension)) {
      after(async () => {
        try {
          const text =
            extension === ".pdf"
              ? sanitizePdfText((await extractPdfText(bytes, { maxPages: 200 })).text)
              : sanitizePdfText(new TextDecoder("utf-8").decode(bytes));
          if (text.trim().length >= 40) {
            const result = await ingestHearingReport({
              hearingId: id,
              documentId,
              title: fileName,
              text,
              mimeType: file.type || null,
              sourceUrl: url,
              hearingTitle: meeting.title
            });
            console.log(`[conocimiento] Informe "${fileName}" indexado: ${result.chunks} fragmentos.`);
          }
        } catch (error) {
          console.error(`[conocimiento] No se pudo indexar "${fileName}":`, error);
        }
      });
    }

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing }, { status: 201 });
  } catch (error) {
    console.error("No se pudo subir el documento de la audiencia", error);
    return NextResponse.json({ error: "No se pudo subir el documento", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}
