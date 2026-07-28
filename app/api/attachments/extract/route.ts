import { NextResponse } from "next/server";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
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
        return NextResponse.json(
          {
            error: "PDF sin capa de texto",
            detail: `"${name}" es un escaneo y no tiene texto seleccionable: todavía no podemos leer documentos escaneados. Si tenés la versión digital (el Word original o un PDF exportado), subí esa. Tip: si podés seleccionar el texto del PDF con el mouse, lo vamos a poder leer.`
          },
          { status: 422 }
        );
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
    return NextResponse.json(
      { error: "No se pudo leer el archivo", detail: "Verificá que el archivo no esté dañado e intentá de nuevo." },
      { status: 422 }
    );
  }
}
