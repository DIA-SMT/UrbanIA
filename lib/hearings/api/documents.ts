import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { attachHearingDocument, registerHearingDocument } from "@/lib/hearings/attach-document";
import { createHearingDocumentUploadUrl, downloadHearingDocument, hasSupabaseStorage, removeHearingDocument } from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { ingestHearingReport } from "@/lib/knowledge/ingest-hearing-report";

/** Formatos con texto que se pueden indexar para el conocimiento de Migue. */
const INGESTABLE_EXTENSIONS = [".pdf", ".txt"];


const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".odt", ".jpg", ".jpeg", ".png", ".webp", ".xls", ".xlsx", ".csv"];

function validateName(fileName: string): NextResponse | null {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      { error: "Formato no soportado", detail: `"${fileName}" no es un formato aceptado (PDF, Word, imágenes, planillas o texto).` },
      { status: 415 }
    );
  }
  return null;
}

function tooHeavy(fileName: string, sizeBytes: number): NextResponse | null {
  if (sizeBytes > MAX_FILE_BYTES) {
    const sizeMb = `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
    return NextResponse.json(
      { error: "Archivo demasiado pesado", detail: `"${fileName}" pesa ${sizeMb} y el límite es 15 MB.` },
      { status: 413 }
    );
  }
  return null;
}

/** Guardas comunes de las operaciones de documentos. Devuelve la respuesta de error o null. */
async function guardDocumentRequest(): Promise<NextResponse | null> {
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
  if (!hasPermission(session, "documents.upload")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  return null;
}

const signSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive()
});

/**
 * Paso 1 de la subida directa: firma una URL para que el browser suba el
 * documento directo al bucket, sin pasar el archivo por la función (el body en
 * Vercel se corta en ~4,5 MB y acá se aceptan 15). Mismo patrón que las normas.
 */
export async function handleDocumentSign(request: Request, id: string) {
  const guarded = await guardDocumentRequest();
  if (guarded) return guarded;

  const parsed = signSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Faltan el nombre o el peso del archivo." }, { status: 400 });
  }

  const invalidName = validateName(parsed.data.fileName);
  if (invalidName) return invalidName;
  const heavy = tooHeavy(parsed.data.fileName, parsed.data.sizeBytes);
  if (heavy) return heavy;

  try {
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const signed = await createHearingDocumentUploadUrl({ meetingId: id, fileName: parsed.data.fileName });
    return NextResponse.json(signed);
  } catch (error) {
    console.error("No se pudo firmar la subida del documento", error);
    return NextResponse.json({ error: "No se pudo preparar la subida", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}

const registerSchema = z.object({
  storagePath: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().positive()
});

/**
 * Registra un documento adjunto de una audiencia. Dos variantes:
 * - JSON {storagePath,...}: paso 2 de la subida directa — el archivo YA está en
 *   el bucket, acá se verifica (existencia y peso reales) y se registra.
 * - multipart con `file`: camino legacy para archivos chicos; el archivo viaja
 *   por la función. Se mantiene para no romper clientes viejos.
 * Devuelve la audiencia actualizada.
 */
export async function handleDocumentUpload(request: Request, id: string) {
  const guarded = await guardDocumentRequest();
  if (guarded) return guarded;
  const session = await getSessionUser();

  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");

  let fileName: string;
  let contentType: string;
  let bytes: Uint8Array;
  let storagePath: string | null = null;

  if (isJson) {
    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", detail: "Falta la referencia del archivo subido." }, { status: 400 });
    }
    // El storagePath lo generó el server al firmar y siempre arranca con el id
    // de la audiencia: si no coincide, es un path ajeno.
    if (!parsed.data.storagePath.startsWith(`${id}/`)) {
      return NextResponse.json({ error: "Referencia inválida", detail: "El archivo no pertenece a esta audiencia." }, { status: 400 });
    }
    const invalidName = validateName(parsed.data.fileName);
    if (invalidName) return invalidName;

    fileName = parsed.data.fileName;
    contentType = parsed.data.contentType || "application/octet-stream";
    storagePath = parsed.data.storagePath;

    // Verificación honesta: se baja el objeto para confirmar que existe y medir
    // el peso REAL (el declarado por el cliente no es confiable). Los bytes se
    // reusan después para la ingesta al conocimiento.
    try {
      bytes = await downloadHearingDocument(storagePath);
    } catch {
      return NextResponse.json(
        { error: "Archivo no encontrado", detail: "La subida no llegó al almacenamiento. Probá de nuevo." },
        { status: 400 }
      );
    }
    const heavy = tooHeavy(fileName, bytes.byteLength);
    if (heavy) {
      // Más pesado que lo prometido: se borra del bucket para no dejar huérfanos.
      await removeHearingDocument(storagePath).catch(() => undefined);
      return heavy;
    }
  } else {
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

    fileName = file.name || "documento";
    const invalidName = validateName(fileName);
    if (invalidName) return invalidName;
    const heavy = tooHeavy(fileName, file.size);
    if (heavy) return heavy;

    contentType = file.type || "application/octet-stream";
    bytes = new Uint8Array(await file.arrayBuffer());
  }

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  try {
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true, title: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const uploader = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }) : null;

    const { documentId, url } = storagePath
      ? await registerHearingDocument({
          meetingId: id,
          fileName,
          contentType,
          storagePath,
          fileSize: bytes.byteLength,
          uploadedByName: uploader?.name ?? null
        })
      : await attachHearingDocument({
          meetingId: id,
          fileName,
          contentType,
          bytes,
          fileSize: bytes.byteLength,
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
              mimeType: contentType || null,
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
