import { NextResponse } from "next/server";
import { z } from "zod";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { hasOcrConfig, ocrScannedPdf } from "@/lib/pdf/ocr";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import {
  createChatAttachmentUploadUrl,
  downloadChatAttachment,
  hasSupabaseStorage,
  removeChatAttachment
} from "@/lib/storage/supabase";

/**
 * Extracción de texto de archivos adjuntos para los chats (Migue y Consulta al
 * CPU). El archivo NO se persiste: se extrae el texto y se devuelve al cliente,
 * que lo reenvía junto con su pregunta.
 *
 * Dos caminos de entrada:
 * - Subida directa (preferido): `?action=sign` firma una URL del bucket
 *   temporal, el browser sube directo (hasta 15 MB, esquivando el tope de
 *   ~4,5 MB del body en Vercel) y después manda acá solo el storagePath. El
 *   objeto se borra apenas se extrae el texto.
 * - Multipart legacy: el archivo viaja en el body (hasta 4 MB, el techo real
 *   de la plataforma). Queda como fallback si el storage no está configurado.
 */

export const dynamic = "force-dynamic";

// Techo real del body de una función en Vercel: ~4,5 MB. Prometer más acá era
// mentirle al usuario (verificado 2026-08-01 con un 413 de plataforma).
const MAX_MULTIPART_BYTES = 4 * 1024 * 1024; // 4 MB
/** Tope de la subida directa. Igual que los documentos de audiencias. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_PDF_PAGES = 40;
const MAX_OCR_PAGES = 8;
const MAX_TEXT_CHARS = 12_000;
const RATE_LIMIT = { limit: 6, windowMs: 60_000 };

const ALLOWED_EXTENSIONS = [".pdf", ".txt"] as const;

function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function unsupportedFormat(name: string): NextResponse {
  return NextResponse.json(
    {
      error: "Formato no soportado",
      detail: `"${name}" no es un formato que podamos leer. Por ahora aceptamos PDF y TXT. Si es un Word, exportalo como PDF (Archivo → Guardar como → PDF) y subilo de nuevo.`
    },
    { status: 415 }
  );
}

function tooHeavy(name: string, sizeBytes: number, maxBytes: number): NextResponse {
  const sizeMb = `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  const maxMb = `${Math.round(maxBytes / (1024 * 1024))} MB`;
  return NextResponse.json(
    {
      error: "Archivo demasiado pesado",
      detail: `"${name}" pesa ${sizeMb} y el límite es ${maxMb}. Probá subir solo las páginas que necesitás: abrí el PDF, elegí Imprimir → "Guardar como PDF" y seleccioná el rango de páginas.`
    },
    { status: 413 }
  );
}

/**
 * Pipeline común de extracción (multipart y subida directa): texto directo del
 * PDF, OCR por visión si es un escaneo, o decodificación simple de TXT.
 */
async function extractResponse(name: string, extension: string, bytes: Uint8Array, sizeBytes: number): Promise<NextResponse> {
  const notes: string[] = [];
  let cleanText = "";
  let truncated = false;

  if (extension === ".pdf") {
    const extracted = await extractPdfText(bytes, { maxPages: MAX_PDF_PAGES, maxChars: MAX_TEXT_CHARS });
    cleanText = sanitizePdfText(extracted.text);
    truncated = extracted.truncated;
    if (extracted.pages > extracted.readPages) {
      notes.push(`Se leyeron las primeras ${extracted.readPages} de ${extracted.pages} páginas.`);
    }
    if (!cleanText.trim()) {
      // Escaneo sin capa de texto: se intenta OCR por visión. Si no hay API
      // key o el OCR no saca nada, se mantiene el rechazo honesto de siempre.
      const ocr = hasOcrConfig()
        ? await ocrScannedPdf(bytes, { maxPages: MAX_OCR_PAGES, maxChars: MAX_TEXT_CHARS }).catch((error) => {
            console.warn("OCR de adjunto falló.", error instanceof Error ? error.message : error);
            return null;
          })
        : null;

      if (ocr?.text.trim()) {
        cleanText = sanitizePdfText(ocr.text);
        truncated = ocr.truncated;
        notes.push(
          `Documento escaneado: se transcribió con OCR${ocr.pages > ocr.readPages ? ` (las primeras ${ocr.readPages} de ${ocr.pages} páginas)` : ""}. Puede contener errores de lectura.`
        );
      } else {
        return NextResponse.json(
          {
            error: "PDF sin capa de texto",
            detail: `"${name}" es un escaneo y no pudimos transcribirlo. Si tenés la versión digital (el Word original o un PDF exportado), subí esa. Tip: si podés seleccionar el texto del PDF con el mouse, lo vamos a poder leer seguro.`
          },
          { status: 422 }
        );
      }
    }
  } else {
    const raw = sanitizePdfText(new TextDecoder("utf-8").decode(bytes));
    truncated = raw.length > MAX_TEXT_CHARS;
    cleanText = truncated ? raw.slice(0, MAX_TEXT_CHARS) : raw;
  }

  if (truncated) {
    notes.push(`El texto se recortó a ${MAX_TEXT_CHARS.toLocaleString("es-AR")} caracteres para no saturar el análisis.`);
  }

  return NextResponse.json({
    name,
    sizeBytes,
    chars: cleanText.length,
    truncated,
    notes,
    text: cleanText
  });
}

const signSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  sizeBytes: z.number().int().positive()
});

/** Paso 1 de la subida directa: valida y firma la URL del bucket temporal. */
async function handleSign(request: Request): Promise<NextResponse> {
  if (!hasSupabaseStorage()) {
    return NextResponse.json(
      { error: "Subida directa no disponible", detail: "El almacenamiento no está configurado en esta instancia." },
      { status: 503 }
    );
  }

  const parsed = signSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Faltan el nombre o el peso del archivo." }, { status: 400 });
  }

  const { fileName, sizeBytes } = parsed.data;
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(fileName) as (typeof ALLOWED_EXTENSIONS)[number])) {
    return unsupportedFormat(fileName);
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return tooHeavy(fileName, sizeBytes, MAX_UPLOAD_BYTES);
  }

  try {
    const signed = await createChatAttachmentUploadUrl(fileName);
    return NextResponse.json(signed);
  } catch (error) {
    console.error("No se pudo firmar la subida del adjunto", error);
    return NextResponse.json(
      { error: "No se pudo preparar la subida", detail: "Intentá nuevamente en unos segundos." },
      { status: 500 }
    );
  }
}

const referenceSchema = z.object({
  storagePath: z.string().trim().min(1).max(300),
  fileName: z.string().trim().min(1).max(160)
});

/** El storagePath lo generó el server al firmar: fecha/uuid-nombre, sin sorpresas. */
const STORAGE_PATH_SHAPE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[\w.\-]+$/;

/** Paso 2 de la subida directa: baja el objeto, extrae el texto y lo borra. */
async function handleExtractByReference(request: Request): Promise<NextResponse> {
  const parsed = referenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !STORAGE_PATH_SHAPE.test(parsed.data.storagePath)) {
    return NextResponse.json({ error: "Referencia inválida", detail: "Falta la referencia del archivo subido." }, { status: 400 });
  }

  const { storagePath, fileName } = parsed.data;
  const extension = extensionOf(fileName);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    await removeChatAttachment(storagePath);
    return unsupportedFormat(fileName);
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadChatAttachment(storagePath);
  } catch {
    return NextResponse.json(
      { error: "Archivo no encontrado", detail: "La subida no llegó al almacenamiento. Probá de nuevo." },
      { status: 400 }
    );
  }

  try {
    // Peso REAL, no el declarado (el bucket además tiene su propio tope de 15 MB).
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return tooHeavy(fileName, bytes.byteLength, MAX_UPLOAD_BYTES);
    }
    return await extractResponse(fileName, extension, bytes, bytes.byteLength);
  } catch (error) {
    console.error("Attachment extraction error", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo", detail: "Verificá que el archivo no esté dañado e intentá de nuevo." },
      { status: 422 }
    );
  } finally {
    // El adjunto no se persiste: puente usado, puente borrado.
    await removeChatAttachment(storagePath);
  }
}

/** Camino multipart legacy: el archivo viaja en el body (hasta 4 MB). */
async function handleMultipart(request: Request): Promise<NextResponse> {
  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    file = null;
  }

  if (!file) {
    return NextResponse.json(
      { error: "Archivo faltante", detail: "Adjuntá un archivo PDF o TXT." },
      { status: 400 }
    );
  }

  const name = file.name || "documento";
  const extension = extensionOf(name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return unsupportedFormat(name);
  }
  if (file.size > MAX_MULTIPART_BYTES) {
    return tooHeavy(name, file.size, MAX_MULTIPART_BYTES);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await extractResponse(name, extension, bytes, file.size);
  } catch (error) {
    console.error("Attachment extraction error", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo", detail: "Verificá que el archivo no esté dañado e intentá de nuevo." },
      { status: 422 }
    );
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(clientKeyFromRequest(request, "attachment-extract"), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados archivos", detail: "Esperá un momento antes de subir otro archivo." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  if (new URL(request.url).searchParams.get("action") === "sign") {
    return handleSign(request);
  }

  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    return handleExtractByReference(request);
  }

  return handleMultipart(request);
}
