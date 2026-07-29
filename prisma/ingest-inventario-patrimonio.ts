import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { KnowledgeSourceKind, PrismaClient, ProcessingStatus } from "@prisma/client";
import OpenAI from "openai";
import { createCanvas } from "@napi-rs/canvas";
import { embedPassages } from "../lib/ai/embeddings";

/**
 * Ingesta del Inventario de Sitios y Edificios de Valor Patrimonial
 * (Anexo I del Decreto 0582/SPDUA/00, reglamentario de la Ordenanza 1773/91),
 * en la edición con la situación de los inmuebles actualizada a 2016.
 *
 * Es una TABLA (edificio · ubicación · propietario · categorización ·
 * observaciones) que pdftotext lee por columnas y deja inservible: quedan
 * todos los nombres juntos y después todas las direcciones, así que un chunk
 * asociaría cada edificio con la dirección de otro. Mismo problema y misma
 * solución que las planillas del CPU (prisma/ingest-planillas.ts): cada hoja
 * se renderiza a imagen y un modelo con visión la transcribe edificio por
 * edificio; eso sí se puede chunkear y embeber.
 *
 * El texto de la Ordenanza 1773/91 y sus decretos NO se ingesta desde acá:
 * ya está en el Digesto Normativo (fuente digesto-catastro-1-2015).
 */

const prisma = new PrismaClient();
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o";
const FALLBACK_VISION_MODEL = process.env.OPENROUTER_VISION_FALLBACK || "openai/gpt-4o-mini";
const RENDER_SCALE = 2.2;
const CHUNK_MAX_CHARS = 2200;
const EMBED_BATCH = 16;

const EXTERNAL_ID = "inventario-patrimonio-2016";
const TITLE = "Inventario de Edificios y Sitios de Valor Patrimonial – situación 2016";
const PDF_FILE = "ordenanza-1773-inventario-patrimonial-2016.pdf";

const PROMPT = [
  "La imagen es una hoja del 'Inventario de Edificios y Sitios de Valor Patrimonial' de San Miguel de Tucumán (Anexo I del Decreto Nº 0582/SPDUA/00, reglamentario de la Ordenanza Nº 1773/91), con la situación de los inmuebles actualizada a 2016.",
  "Es una tabla con columnas: EDIFICIO/SITIO, UBICACIÓN, PROPIETARIO – SITUACIÓN JURÍDICA, OBSERVACIONES y CATEGORIZACIÓN (IM, CPA, MHM o MHN).",
  "CRÍTICO: los datos de un edificio son los de SU MISMA FILA horizontal. Recorré la tabla fila por fila y verificá para cada edificio que la ubicación, el propietario, las observaciones y la categorización estén tomados de esa fila y no de la anterior o la siguiente. Muchas celdas de OBSERVACIONES y de PROPIETARIO están vacías: no corras datos de otra fila para llenarlas.",
  "Algunas filas están RESALTADAS (fondo amarillo): marcan inmuebles con novedades en su situación a 2016 (demoliciones, pedidos de demolición, etc.). Para esas filas agregá la línea '- Situación 2016: resaltado en el relevamiento'.",
  "Transcribí la hoja COMPLETA a texto estructurado, edificio por edificio, con este formato exacto:",
  "",
  "HOJA: <n/7>",
  "SECCIÓN: <título del grupo si figura, ej. EDIFICIOS Y SITIOS DE INTERES MUNICIPAL>",
  "## <NOMBRE DEL EDIFICIO O SITIO>",
  "- Ubicación: <dirección tal como figura>",
  "- Propietario / situación jurídica: <lo que figure; omitir la línea si la celda está vacía>",
  "- Categorización: <sigla tal como figura, ej. IM, CPA, IM/MHN>",
  "- Observaciones: <lo que figure; omitir la línea si no hay>",
  "- Situación 2016: resaltado en el relevamiento  <solo si la fila está resaltada>",
  "",
  "Siglas: IM = Interés Municipal; CPA = Componente del Patrimonio Arquitectónico; MHM = Monumento Histórico Municipal; MHN = Monumento Histórico Nacional. Explicalas una sola vez en una sección 'REFERENCIAS' al final.",
  "Si la hoja es el resumen final (totales de bienes), transcribila como sección 'RESUMEN' con los totales.",
  "El texto auxiliar (OCR de layout) puede estar desalineado; la IMAGEN es la fuente de verdad para qué dato corresponde a qué edificio. No inventes edificios ni datos que no estén en la hoja."
].join("\n");

type SheetTranscript = { page: number; hoja: string | null; text: string };

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY no configurada");
  return new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
}

function layoutTextForPage(pdfPath: string, page: number): string {
  try {
    return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", "-f", String(page), "-l", String(page), pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024
    });
  } catch {
    return "";
  }
}

async function loadPdf(filePath: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  return getDocument({ data, useSystemFonts: true }).promise;
}

async function renderPageToPng(pdf: Awaited<ReturnType<typeof loadPdf>>, pageNumber: number): Promise<Buffer> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as any, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function transcribeSheet(client: OpenAI, png: Buffer, auxText: string, label: string): Promise<string | null> {
  const attempts = [VISION_MODEL, VISION_MODEL, VISION_MODEL, FALLBACK_VISION_MODEL];
  for (let attempt = 0; attempt < attempts.length; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: attempts[attempt],
        temperature: 0,
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${PROMPT}\n\nTexto auxiliar (referencia, puede estar desalineado):\n${auxText.slice(0, 4000)}` },
              { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } }
            ]
          }
        ]
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text && text.length > 100) return text;
      throw new Error("respuesta vacía o demasiado corta");
    } catch (error) {
      console.warn(`  ${label}: intento ${attempt + 1} (${attempts[attempt]}) falló (${error instanceof Error ? error.message : error})`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  return null;
}

function splitTranscript(text: string): string[] {
  if (text.length <= CHUNK_MAX_CHARS) return [text];
  const header = text.split(/\n(?=## )/)[0];
  const sections = text.split(/\n(?=## )/).slice(1);
  const parts: string[] = [];
  let current = header;
  for (const section of sections) {
    if ((current + "\n" + section).length > CHUNK_MAX_CHARS && current.trim()) {
      parts.push(current.trim());
      current = `${header.split("\n")[0]}\n${section}`;
    } else {
      current += `\n${section}`;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function main() {
  const client = getClient();
  const pdfPath = join(process.cwd(), "data", "sources", PDF_FILE);
  const cacheDir = join(process.cwd(), "data", "extracted", "inventario-cache");
  await mkdir(cacheDir, { recursive: true });
  const pdf = await loadPdf(pdfPath);

  // El PDF trae primero la ordenanza y los decretos (eso ya está en el digesto);
  // la tabla arranca en la página del "ANEXO I ... INVENTARIO".
  let firstTablePage = -1;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const aux = layoutTextForPage(pdfPath, pageNumber);
    pageTexts.push(aux);
    if (firstTablePage < 0 && /ANEXO I/.test(aux) && /INVENTARIO EDIFICIOS/.test(aux)) firstTablePage = pageNumber;
  }
  if (firstTablePage < 0) throw new Error("No se encontró la página del ANEXO I / INVENTARIO en el PDF.");
  console.log(`${EXTERNAL_ID}: tabla desde la página ${firstTablePage} de ${pdf.numPages}. Transcribiendo con ${VISION_MODEL}...`);

  const transcripts: SheetTranscript[] = [];
  const skipped: number[] = [];
  for (let pageNumber = firstTablePage; pageNumber <= pdf.numPages; pageNumber += 1) {
    const aux = pageTexts[pageNumber - 1];
    if (!aux.trim()) {
      console.log(`  p${pageNumber}/${pdf.numPages} en blanco, se omite`);
      continue;
    }
    const cachePath = join(cacheDir, `${EXTERNAL_ID}-p${String(pageNumber).padStart(2, "0")}.txt`);
    let text: string | null = null;
    let fromCache = false;
    if (existsSync(cachePath)) {
      text = (await readFile(cachePath, "utf8")).trim() || null;
      fromCache = Boolean(text);
    }
    if (!text) {
      const png = await renderPageToPng(pdf, pageNumber);
      text = await transcribeSheet(client, png, aux, `${EXTERNAL_ID} p${pageNumber}`);
      if (text) await writeFile(cachePath, text, "utf8");
    }
    if (!text) {
      skipped.push(pageNumber);
      console.warn(`  p${pageNumber}/${pdf.numPages} OMITIDA (sin transcripción tras reintentos)`);
      continue;
    }
    const hoja = text.match(/HOJA:\s*([\d]+\s*\/\s*[\d]+)/i)?.[1]?.replace(/\s+/g, "") ?? aux.match(/([\d]+\s*\/\s*7)\b/)?.[1]?.replace(/\s+/g, "") ?? null;
    transcripts.push({ page: pageNumber, hoja, text });
    console.log(`  p${pageNumber}/${pdf.numPages} ${fromCache ? "cache" : "ok"} (hoja ${hoja ?? "?"}, ${text.length} chars)`);
  }
  if (skipped.length) console.warn(`${EXTERNAL_ID}: páginas omitidas: ${skipped.join(", ")} (reintentá borrando su cache)`);
  if (!transcripts.length) throw new Error("Ninguna página del inventario pudo transcribirse.");

  const chunks = transcripts.flatMap((sheet) =>
    splitTranscript(sheet.text).map((part, partIndex) => ({
      content: part,
      embedText: `${TITLE} — hoja ${sheet.hoja ?? sheet.page}\n${part}`.slice(0, 1800),
      metadata: { source: EXTERNAL_ID, doc: TITLE, hoja: sheet.hoja, page: sheet.page, part: partIndex, pipeline: "vision" }
    }))
  );

  const wordCount = chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0);
  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId: EXTERNAL_ID } },
    update: { title: TITLE, filePath: `data/sources/${PDF_FILE}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount, metadata: { pipeline: `vision:${VISION_MODEL}+e5-small`, version: "2016" } },
    create: { kind: KnowledgeSourceKind.REGULATION, externalId: EXTERNAL_ID, title: TITLE, filePath: `data/sources/${PDF_FILE}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount, metadata: { pipeline: `vision:${VISION_MODEL}+e5-small`, version: "2016" } }
  });
  await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((chunk, index) => ({ sourceId: source.id, chunkIndex: index, content: chunk.content, tokenEstimate: Math.ceil(chunk.content.length / 4), metadata: chunk.metadata }))
  });

  const stored = await prisma.knowledgeChunk.findMany({ where: { sourceId: source.id }, orderBy: { chunkIndex: "asc" }, select: { id: true } });
  console.log(`${EXTERNAL_ID}: ${chunks.length} chunks. Embebiendo...`);
  for (let start = 0; start < stored.length; start += EMBED_BATCH) {
    const ids = stored.slice(start, start + EMBED_BATCH).map((chunk) => chunk.id);
    const vectors = await embedPassages(chunks.slice(start, start + EMBED_BATCH).map((chunk) => chunk.embedText));
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeChunk" AS k SET embedding = v.emb::vector
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS emb) AS v
       WHERE k.id = v.id`,
      ids,
      vectors.map((vector) => `[${vector.join(",")}]`)
    );
  }
  await prisma.knowledgeSource.update({ where: { id: source.id }, data: { status: ProcessingStatus.READY, processedAt: new Date() } });
  console.log(JSON.stringify({ externalId: EXTERNAL_ID, pages: transcripts.length, chunks: chunks.length, skippedPages: skipped }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
