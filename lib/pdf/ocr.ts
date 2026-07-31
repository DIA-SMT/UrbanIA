// OCR de PDFs escaneados (sin capa de texto) con visión vía OpenRouter.
//
// Mismo patrón que prisma/ingest-planillas.ts: cada página se renderiza a PNG
// con pdfjs + @napi-rs/canvas y un modelo multimodal la transcribe. Acá el
// objetivo es distinto: no es una matriz conocida sino papel municipal
// arbitrario (notas, expedientes, ordenanzas escaneadas), así que el prompt
// pide transcripción fiel y nada más.
//
// Sin "server-only" a propósito, igual que extract-text.ts: esto también puede
// correr desde scripts tsx fuera de Next.

type PdfPage = {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvas: unknown; viewport: unknown }): { promise: Promise<void> };
};
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> };

export type PdfOcrResult = {
  /** Texto transcripto, una sección por página con marca "[Página N]". */
  text: string;
  /** Total de páginas del documento. */
  pages: number;
  /** Cuántas se transcribieron (limitadas por maxPages). */
  readPages: number;
  /** true si el texto se cortó por el tope de caracteres. */
  truncated: boolean;
};

export type PdfOcrOptions = {
  /** Máximo de páginas a transcribir. Default: 8 (el OCR por visión cuesta tiempo y tokens). */
  maxPages?: number;
  /** Máximo de caracteres a devolver. Default: sin tope. */
  maxChars?: number;
};

const DEFAULT_MAX_PAGES = 8;
const RENDER_SCALE = 2;
// El modelo chico alcanza para texto corrido; el grande queda de respaldo para
// páginas donde el chico devuelve vacío (pasa de forma intermitente).
const OCR_MODEL = () => process.env.OPENROUTER_OCR_MODEL || "openai/gpt-4o-mini";
const FALLBACK_MODEL = () => process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o";
const EMPTY_PAGE_MARK = "[página sin texto]";

const OCR_PROMPT = [
  "La imagen es una página de un documento escaneado aportado a la Municipalidad de San Miguel de Tucumán (puede ser una nota, un expediente, una ordenanza, un plano con texto o un formulario).",
  "Transcribí TODO el texto legible, fiel y en orden de lectura.",
  "- Conservá títulos, listas y numeraciones como líneas de texto.",
  "- Si hay una tabla, transcribila fila por fila separando las celdas con ' | '.",
  "- Si una palabra o zona no se lee, escribí [ilegible] en su lugar. No adivines ni completes.",
  "- No resumas, no traduzcas, no agregues comentarios ni explicaciones.",
  `- Si la página no tiene texto (foto, plano mudo, página en blanco), respondé exactamente: ${EMPTY_PAGE_MARK}`,
  "Respondé únicamente con la transcripción."
].join("\n");

export function hasOcrConfig(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function loadPdf(buffer: Uint8Array): Promise<PdfDocument> {
  const { ensurePdfjsNodeGlobals } = await import("./node-polyfills");
  await ensurePdfjsNodeGlobals();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copia defensiva: pdfjs transfiere y detacha el buffer que recibe (ver
  // extract-text.ts, mismo motivo).
  return (await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise) as unknown as PdfDocument;
}

async function renderPageToPng(pdf: PdfDocument, pageNumber: number): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function transcribePage(png: Buffer, label: string): Promise<string | null> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  // 2 intentos con el modelo de OCR + 1 con el de respaldo.
  const attempts = [OCR_MODEL(), OCR_MODEL(), FALLBACK_MODEL()];
  for (const model of attempts) {
    try {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) {
        return text;
      }
    } catch (error) {
      console.warn(`OCR falló en ${label} con ${model}.`, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/**
 * Transcribe un PDF escaneado página por página con visión. Devuelve el texto
 * con los mismos marcadores `[Página N]` que extractPdfText, para que los
 * consumidores no distingan de dónde salió.
 */
export async function ocrScannedPdf(buffer: Uint8Array, options: PdfOcrOptions = {}): Promise<PdfOcrResult> {
  if (!hasOcrConfig()) {
    throw new Error("OPENROUTER_API_KEY no configurada: no hay OCR disponible.");
  }

  const pdf = await loadPdf(buffer);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
  const readPages = Math.min(pdf.numPages, maxPages);

  // De a 2 páginas en paralelo: reduce la espera sin ametrallar al proveedor.
  const results: (string | null)[] = new Array(readPages).fill(null);
  let next = 0;
  async function worker() {
    while (next < readPages) {
      const index = next;
      next += 1;
      const png = await renderPageToPng(pdf, index + 1);
      results[index] = await transcribePage(png, `página ${index + 1}`);
    }
  }
  await Promise.all([worker(), worker()]);

  const parts: string[] = [];
  for (let index = 0; index < readPages; index += 1) {
    const pageText = results[index];
    if (pageText && pageText !== EMPTY_PAGE_MARK) {
      parts.push(`[Página ${index + 1}] ${pageText}`);
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
