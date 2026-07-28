// Extraccion de texto de PDF, compartida por varios consumidores con
// necesidades distintas:
//   - el chat (adjuntos de Migue): tope bajo, para no saturar el prompt;
//   - la ingesta de conocimiento (informes de audiencias): el documento entero;
//   - el importador de la Fabrica de Normas: tope alto + limpieza de tablas.
// Por eso los limites son parametros y NO constantes fijas.
//
// Sin "server-only" a proposito: lo usan scripts de backfill que corren por tsx
// fuera de Next, donde importar "server-only" tira.
//
// Usa la build legacy `.mjs` de pdfjs: la `.js` NO resuelve en este entorno.

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
  /**
   * Junta las corridas de letras sueltas que dejan las tablas (ver
   * collapseSpacedLetters). Apagado por defecto: solo lo pide el importador de
   * normas, que lee presentaciones llenas de tablas mal extraídas.
   */
  collapseSpaced?: boolean;
};

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
 * base de la trazabilidad: permiten decir de que pagina salio cada cosa.
 */
export async function extractPdfText(buffer: Uint8Array, options: PdfExtractOptions = {}): Promise<PdfExtraction> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copia defensiva: pdfjs TRANSFIERE el buffer que recibe y lo deja detachado,
  // asi que reusar el mismo Uint8Array en una segunda llamada revienta con
  // "Cannot transfer object of unsupported type" (verificado). Que esta funcion
  // destruya el argumento de quien la llama es una sorpresa fea; el costo de
  // copiar es una sola pasada de memoria.
  const pdf = (await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise) as unknown as PdfDocument;

  const maxPages = options.maxPages ?? pdf.numPages;
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
  const readPages = Math.min(pdf.numPages, maxPages);

  const parts: string[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= readPages && totalChars < maxChars; pageNumber += 1) {
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

  const full = parts.join("\n\n");
  const truncated = full.length > maxChars;

  return {
    text: truncated ? full.slice(0, maxChars) : full,
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
