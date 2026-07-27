// Sin "server-only" a proposito: lo usa el script de backfill (ingesta de docs)
// que corre por tsx fuera de Next, donde importar "server-only" tira.
//
/**
 * Extracción de texto de PDF, compartida por el chat (adjuntos de Migue) y la
 * ingesta de conocimiento (informes de audiencias). Usa la build legacy `.mjs`
 * de pdfjs: la `.js` NO resuelve en este entorno.
 *
 * El chat quiere un tope bajo (no saturar el prompt); la ingesta quiere el
 * documento entero. Por eso los límites son parámetros, no constantes fijas.
 */

type PdfTextContent = { items: unknown[] };
type PdfPage = { getTextContent(): Promise<PdfTextContent> };
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> };
type PdfTextItem = { str?: unknown };

export type PdfExtraction = {
  /** Texto extraído, una sección por página con marca "[Página N]". */
  text: string;
  /** Total de páginas del documento. */
  pages: number;
  /** Cuántas se llegaron a leer (puede ser menor por el tope de páginas). */
  readPages: number;
  /** true si el texto se cortó por el tope de caracteres. */
  truncated: boolean;
};

export type PdfExtractOptions = {
  /** Máximo de páginas a leer. Default: sin tope. */
  maxPages?: number;
  /** Máximo de caracteres a devolver. Default: sin tope. */
  maxChars?: number;
};

export async function extractPdfText(buffer: Uint8Array, options: PdfExtractOptions = {}): Promise<PdfExtraction> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = (await getDocument({ data: buffer, useSystemFonts: true }).promise) as unknown as PdfDocument;

  const maxPages = options.maxPages ?? pdf.numPages;
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
  const readPages = Math.min(pdf.numPages, maxPages);

  const parts: string[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= readPages && totalChars < maxChars; pageNumber += 1) {
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

  const full = parts.join("\n\n");
  const truncated = full.length > maxChars;

  return {
    text: truncated ? full.slice(0, maxChars) : full,
    pages: pdf.numPages,
    readPages,
    truncated
  };
}

/** Elimina caracteres de control (salvo saltos de línea y tabs) que ensucian el texto. */
export function sanitizePdfText(value: string): string {
  let clean = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 || code === 10 || code === 9) {
      clean += char;
    }
  }
  return clean.trim();
}
