import { NextResponse } from "next/server";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { hasOcrConfig, ocrScannedPdf } from "@/lib/pdf/ocr";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

/**
 * Extracción de texto de archivos adjuntos para los chats (Migue y Consulta al
 * CPU). El archivo NO se persiste: se extrae el texto en memoria y se devuelve
 * al cliente, que lo reenvía junto con su pregunta. Límites para no saturar:
 * peso máximo del archivo, páginas máximas de PDF y tope de caracteres.
 */

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PDF_PAGES = 40;
// El OCR por visión cuesta tiempo (~3-5 s por página) y tokens: se transcriben
// solo las primeras páginas de un escaneo. Alcanza para notas y expedientes
// cortos, que es lo que circula escaneado.
const MAX_OCR_PAGES = 8;
const MAX_TEXT_CHARS = 12_000;
const RATE_LIMIT = { limit: 6, windowMs: 60_000 };

const ALLOWED_EXTENSIONS = [".pdf", ".txt"] as const;

// La extraccion vive en lib/pdf/extract-text.ts: la comparte el importador de
// la Fabrica de Normas, que usa limites mucho mas altos. Los de esta ruta no
// cambian.

export async function POST(request: Request) {
  const rate = checkRateLimit(clientKeyFromRequest(request, "attachment-extract"), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados archivos", detail: "Esperá un momento antes de subir otro archivo." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

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
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return NextResponse.json(
      {
        error: "Formato no soportado",
        detail: `"${name}" no es un formato que podamos leer. Por ahora aceptamos PDF y TXT. Si es un Word, exportalo como PDF (Archivo → Guardar como → PDF) y subilo de nuevo.`
      },
      { status: 415 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = `${(file.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
    return NextResponse.json(
      {
        error: "Archivo demasiado pesado",
        detail: `"${name}" pesa ${sizeMb} y el límite es 5 MB. Probá subir solo las páginas que necesitás: abrí el PDF, elegí Imprimir → "Guardar como PDF" y seleccioná el rango de páginas.`
      },
      { status: 413 }
    );
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());

    const notes: string[] = [];
    let cleanText = "";
    // La lib ya sanea y recorta el PDF, asi que devuelve ella si hubo recorte;
    // para .txt se hace aca, igual que siempre.
    let truncated = false;

    if (extension === ".pdf") {
      const extracted = await extractPdfText(buffer, { maxPages: MAX_PDF_PAGES, maxChars: MAX_TEXT_CHARS });
      // extractPdfText devuelve el texto crudo: sanear es responsabilidad del
      // llamador (asi la ingesta de conocimiento decide por su cuenta).
      cleanText = sanitizePdfText(extracted.text);
      truncated = extracted.truncated;
      if (extracted.pages > extracted.readPages) {
        notes.push(`Se leyeron las primeras ${extracted.readPages} de ${extracted.pages} páginas.`);
      }
      if (!cleanText.trim()) {
        // Escaneo sin capa de texto: se intenta OCR por visión. Si no hay API
        // key o el OCR no saca nada, se mantiene el rechazo honesto de siempre.
        const ocr = hasOcrConfig()
          ? await ocrScannedPdf(buffer, { maxPages: MAX_OCR_PAGES, maxChars: MAX_TEXT_CHARS }).catch((error) => {
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
      const raw = sanitizePdfText(new TextDecoder("utf-8").decode(buffer));
      truncated = raw.length > MAX_TEXT_CHARS;
      cleanText = truncated ? raw.slice(0, MAX_TEXT_CHARS) : raw;
    }

    if (truncated) {
      notes.push(`El texto se recortó a ${MAX_TEXT_CHARS.toLocaleString("es-AR")} caracteres para no saturar el análisis.`);
    }

    return NextResponse.json({
      name,
      sizeBytes: file.size,
      chars: cleanText.length,
      truncated,
      notes,
      text: cleanText
    });
  } catch (error) {
    console.error("Attachment extraction error", error);
    // Modo diagnostico TEMPORAL (2026-08-01, bug DOMMatrix en Vercel): con el
    // header se devuelve el mensaje real del error para poder diagnosticar
    // produccion sin acceso a los logs. Sacar cuando el bug quede cerrado.
    const debugDetail =
      request.headers.get("x-debug-extract") === "1" && error instanceof Error ? `${error.name}: ${error.message}` : null;
    return NextResponse.json(
      {
        error: "No se pudo leer el archivo",
        detail: debugDetail ?? "Verificá que el archivo no esté dañado e intentá de nuevo."
      },
      { status: 422 }
    );
  }
}
