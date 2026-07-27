// Extraccion de texto de PDFs. Vive aca y no dentro de una ruta porque la usan
// dos consumidores con limites muy distintos: el adjunto de los chats (5 MB, 40
// paginas, 12.000 chars) y el importador de la Fabrica de Normas (30 MB, ~120
// paginas, ~40.000 chars).
//
// Sin "server-only": pdfjs corre igual en un script de verificacion con tsx.

type PdfTextContent = { items: unknown[] };
type PdfPage = { getTextContent(): Promise<PdfTextContent> };
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> };
type PdfTextItem = { str?: unknown };

export type ExtractOptions = {
  maxPages?: number;
  maxChars?: number;
  /**
   * Colapsa las corridas de letras sueltas que dejan las tablas. Apagado por
   * defecto para no cambiar el comportamiento de quien ya usaba esta funcion.
   */
  collapseSpaced?: boolean;
};

export type ExtractedPdf = {
  /** Texto ya saneado y recortado a maxChars. */
  text: string;
  /** Paginas del documento. */
  pages: number;
  /** Paginas efectivamente leidas (tope maxPages). */
  readPages: number;
  /** El texto se recorto por maxChars. */
  truncated: boolean;
};

const DEFAULT_MAX_PAGES = 40;
const DEFAULT_MAX_CHARS = 12_000;

/** Elimina caracteres de control (salvo saltos de línea y tabs) que ensucian el prompt. */
export function sanitizeText(value: string): string {
  let clean = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 || code === 10 || code === 9) {
      clean += char;
    }
  }
  return clean.trim();
}

/**
 * Junta las corridas de letras sueltas que produce la extraccion de tablas.
 *
 * En las diapositivas, una celda como "POZO EN LA MATERNIDAD" puede salir
 * "PO ZOENLAM ATERN ID AD" o, peor, letra por letra: "L A M U N I C I".
 *
 * El criterio es DELIBERADAMENTE conservador: solo se colapsa una corrida de 4
 * o mas tokens de un unico caracter alfanumerico, dentro de una misma linea.
 * Con menos de 4 no hay forma de distinguir una tabla rota de texto legitimo
 * ("la B y la C", "plan A"), y el costo de equivocarse es alto: preferimos
 * texto feo a texto inventado, porque despues esto alimenta a un modelo que
 * tiene que citar textual.
 *
 * No reconstruye la frase original —eso seria adivinar— solo baja el ruido.
 */
export function collapseSpacedLetters(value: string): string {
  const MIN_RUN = 4;
  const isSingleAlnum = (token: string) => token.length === 1 && /[A-Za-z0-9]/.test(token);

  return value
    .split("\n")
    .map((line) => {
      const tokens = line.split(" ");
      const out: string[] = [];
      let run: string[] = [];

      const flush = () => {
        if (run.length >= MIN_RUN) out.push(run.join(""));
        else out.push(...run);
        run = [];
      };

      for (const token of tokens) {
        if (isSingleAlnum(token)) {
          run.push(token);
          continue;
        }
        flush();
        out.push(token);
      }
      flush();

      return out.join(" ");
    })
    .join("\n");
}

/**
 * Texto de un PDF, pagina por pagina, con marcadores `[Página N]` que son la
 * base de la trazabilidad: permiten decir de que pagina salio cada propuesta.
 */
export async function extractPdfText(buffer: Uint8Array, options: ExtractOptions = {}): Promise<ExtractedPdf> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copia defensiva: pdfjs TRANSFIERE el buffer que recibe y lo deja detachado,
  // asi que reusar el mismo Uint8Array en una segunda llamada revienta con
  // "Cannot transfer object of unsupported type" (verificado). Que esta funcion
  // destruya el argumento de quien la llama es una sorpresa fea; el costo de
  // copiar es una sola pasada de memoria.
  const pdf = (await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise) as unknown as PdfDocument;
  const readPages = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];
  let totalChars = 0;

  // El tope de lectura va al doble de maxChars: se sanea y recorta despues, y
  // asi el recorte cae sobre texto ya limpio.
  for (let pageNumber = 1; pageNumber <= readPages && totalChars < maxChars * 2; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = (content.items as PdfTextItem[])
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (options.collapseSpaced) pageText = collapseSpacedLetters(pageText);

    if (pageText) {
      parts.push(`[Página ${pageNumber}] ${pageText}`);
      totalChars += pageText.length;
    }
  }

  const clean = sanitizeText(parts.join("\n\n"));
  const truncated = clean.length > maxChars;

  return {
    text: truncated ? clean.slice(0, maxChars) : clean,
    pages: pdf.numPages,
    readPages,
    truncated
  };
}

/** Números de página presentes en el texto extraído, leídos de los marcadores. */
export function pagesInText(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/\[Página (\d+)\]/g)) {
    found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}
