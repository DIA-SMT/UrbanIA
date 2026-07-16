import { NextResponse } from "next/server";
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

type PdfTextContent = { items: unknown[] };
type PdfPage = { getTextContent(): Promise<PdfTextContent> };
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> };
type PdfTextItem = { str?: unknown };

async function extractPdfText(buffer: Uint8Array): Promise<{ text: string; pages: number; readPages: number }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = (await getDocument({ data: buffer, useSystemFonts: true }).promise) as unknown as PdfDocument;
  const readPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= readPages && totalChars < MAX_TEXT_CHARS * 2; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfTextItem[])
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) {
      parts.push(`[Página ${pageNumber}] ${pageText}`);
      totalChars += pageText.length;
    }
  }

  return { text: parts.join("\n\n"), pages: pdf.numPages, readPages };
}

/** Elimina caracteres de control (salvo saltos de línea y tabs) que ensucian el prompt. */
function sanitizeText(value: string): string {
  let clean = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 || code === 10 || code === 9) {
      clean += char;
    }
  }
  return clean.trim();
}

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

    let rawText = "";
    const notes: string[] = [];

    if (extension === ".pdf") {
      const extracted = await extractPdfText(buffer);
      rawText = extracted.text;
      if (extracted.pages > extracted.readPages) {
        notes.push(`Se leyeron las primeras ${extracted.readPages} de ${extracted.pages} páginas.`);
      }
      if (!rawText.trim()) {
        return NextResponse.json(
          {
            error: "PDF sin capa de texto",
            detail: `"${name}" es un escaneo y no tiene texto seleccionable: todavía no podemos leer documentos escaneados. Si tenés la versión digital (el Word original o un PDF exportado), subí esa. Tip: si podés seleccionar el texto del PDF con el mouse, lo vamos a poder leer.`
          },
          { status: 422 }
        );
      }
    } else {
      rawText = new TextDecoder("utf-8").decode(buffer);
    }

    const cleanText = sanitizeText(rawText);
    const truncated = cleanText.length > MAX_TEXT_CHARS;
    if (truncated) {
      notes.push(`El texto se recortó a ${MAX_TEXT_CHARS.toLocaleString("es-AR")} caracteres para no saturar el análisis.`);
    }

    return NextResponse.json({
      name,
      sizeBytes: file.size,
      chars: Math.min(cleanText.length, MAX_TEXT_CHARS),
      truncated,
      notes,
      text: truncated ? cleanText.slice(0, MAX_TEXT_CHARS) : cleanText
    });
  } catch (error) {
    console.error("Attachment extraction error", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo", detail: "Verificá que el archivo no esté dañado e intentá de nuevo." },
      { status: 422 }
    );
  }
}
