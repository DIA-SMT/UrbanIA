import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { KnowledgeSourceKind, PrismaClient, ProcessingStatus } from "@prisma/client";
import OpenAI from "openai";
import { createCanvas } from "@napi-rs/canvas";
import { embedPassages } from "../lib/ai/embeddings";

/**
 * Ingesta de las PLANILLAS del CPU (tablas) usando visión:
 * cada hoja del PDF se renderiza a imagen y un modelo multimodal la transcribe
 * a texto estructurado confiable (pdftotext desalinea estas matrices).
 * Luego se chunkeea, embebe (e5-small local) y guarda en KnowledgeChunk.
 */

const prisma = new PrismaClient();
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o";
const RENDER_SCALE = 2.2;
const CHUNK_MAX_CHARS = 2200;
const EMBED_BATCH = 16;

const USO_PROMPT = [
  "La imagen es una hoja de la 'Planilla de Disposiciones Particulares sobre Usos del Suelo para cada Distrito' del Código de Planeamiento Urbano de San Miguel de Tucumán.",
  "Es una matriz: filas = actividades/usos; columnas = distritos (C1a, C1b, C2, C3, C4a, C4b, AE1..AE5, R1, R3a, R3b, R4a, R4b, R2a, R2b, S1, S2, S3, I1, I2) más columnas de carga/estacionamiento.",
  "Transcribí la hoja COMPLETA a texto estructurado, actividad por actividad, con este formato exacto:",
  "",
  "HOJA: <n/63>",
  "## <NOMBRE DE ACTIVIDAD>",
  "- Permitido sin restricciones en: <lista de distritos>",
  "- Permitido con límite en: <distrito: límite, ej. R3a: hasta 100 m2> (omitir si no hay)",
  "- No permitido en: <lista o 'resto de los distritos'>",
  "- Estacionamiento/carga: <valor si figura, ej. 5, 7, N.O., #>",
  "- Notas: <referencias (+), (++), etc. con su significado según el pie de la hoja> (omitir si no hay)",
  "",
  "Al final agregá una sección 'NOTAS DE LA HOJA' con el texto de las notas al pie y 'MODIFICADA POR' con las ordenanzas indicadas.",
  "Usá el texto auxiliar (extraído por OCR de layout, puede estar desalineado) SOLO para confirmar nombres; la IMAGEN es la fuente de verdad para qué celda corresponde a qué distrito.",
  "No inventes actividades ni distritos que no estén en la hoja."
].join("\n");

const EDIFICACION_PROMPT = [
  "La imagen es una hoja de las 'Planillas de Edificación' del Código de Planeamiento Urbano de San Miguel de Tucumán: parámetros urbanísticos de UN distrito (o sector de distrito).",
  "Transcribí la hoja COMPLETA a texto estructurado con este formato:",
  "",
  "HOJA: <n/34>",
  "DISTRITO: <código y nombre, ej. C1a Comercial 1a> <sector/delimitación si figura>",
  "## <TIPOLOGÍA EDILICIA> (ej. vivienda individual, colectiva entre medianeras, perímetro libre, otros usos)",
  "- División parcelaria mínima: frente <m>, superficie <m2>",
  "- FOT: <valor/es, indicando parcelas mediales/esquinas si aplica>",
  "- Altura máxima: <valor>; Basamento: <valor>",
  "- Retiros: frente <..>, lateral <..>, fondo <..>",
  "- Cuerpo saliente/voladizo: <valores si figuran>",
  "- Otras condiciones: <lo que figure>",
  "",
  "Usá las abreviaturas tal cual (S.R. sin restricciones, N.O. no obligatorio, N.P. no permitido) explicándolas una vez en una sección 'REFERENCIAS'.",
  "Cerrá con 'NOTAS DE LA HOJA' (notas al pie, ordenanzas modificatorias).",
  "El texto auxiliar puede estar desalineado; la IMAGEN es la fuente de verdad. No inventes valores."
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

async function renderPageToPng(pdf: Awaited<ReturnType<typeof loadPdf>>, pageNumber: number): Promise<Buffer> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  // pdfjs v5+ recibe el canvas directamente (API nueva); el de @napi-rs/canvas es compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as any, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function loadPdf(filePath: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  return getDocument({ data, useSystemFonts: true }).promise;
}

const FALLBACK_VISION_MODEL = process.env.OPENROUTER_VISION_FALLBACK || "openai/gpt-4o-mini";

/** Devuelve la transcripción o null si la página no pudo transcribirse (no aborta la corrida). */
async function transcribeSheet(client: OpenAI, png: Buffer, auxText: string, prompt: string, label: string): Promise<string | null> {
  // 3 intentos con el modelo principal + 1 con el de respaldo (algunas páginas
  // devuelven respuesta vacía de forma intermitente).
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
              { type: "text", text: `${prompt}\n\nTexto auxiliar (referencia, puede estar desalineado):\n${auxText.slice(0, 4000)}` },
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
  // Cortamos por actividad/tipología (##) agrupando hasta el máximo.
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

async function ingestPlanilla(externalId: string, title: string, fileName: string, prompt: string) {
  const client = getClient();
  const pdfPath = join(process.cwd(), "data", "sources", fileName);
  const cacheDir = join(process.cwd(), "data", "extracted", "planillas-cache");
  await mkdir(cacheDir, { recursive: true });
  const pdf = await loadPdf(pdfPath);
  console.log(`${externalId}: ${pdf.numPages} páginas. Transcribiendo con ${VISION_MODEL}...`);

  const transcripts: SheetTranscript[] = [];
  const skipped: number[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const cachePath = join(cacheDir, `${externalId}-p${String(pageNumber).padStart(2, "0")}.txt`);
    const aux = layoutTextForPage(pdfPath, pageNumber);
    let text: string | null = null;
    let fromCache = false;

    if (existsSync(cachePath)) {
      text = (await readFile(cachePath, "utf8")).trim() || null;
      fromCache = Boolean(text);
    }
    if (!text) {
      const png = await renderPageToPng(pdf, pageNumber);
      text = await transcribeSheet(client, png, aux, prompt, `${externalId} p${pageNumber}`);
      if (text) await writeFile(cachePath, text, "utf8");
    }
    if (!text) {
      skipped.push(pageNumber);
      console.warn(`  p${pageNumber}/${pdf.numPages} OMITIDA (sin transcripción tras reintentos)`);
      continue;
    }

    const hoja = text.match(/HOJA:\s*([\d]+\s*\/\s*[\d]+)/i)?.[1]?.replace(/\s+/g, "") ?? aux.match(/hoja\s*([\d]+\s*\/\s*[\d]+)/i)?.[1]?.replace(/\s+/g, "") ?? null;
    transcripts.push({ page: pageNumber, hoja, text });
    console.log(`  p${pageNumber}/${pdf.numPages} ${fromCache ? "cache" : "ok"} (hoja ${hoja ?? "?"}, ${text.length} chars)`);
  }
  if (skipped.length) console.warn(`${externalId}: páginas omitidas: ${skipped.join(", ")} (reintentá borrando su cache)`);

  const chunks = transcripts.flatMap((sheet) =>
    splitTranscript(sheet.text).map((part, partIndex) => ({
      content: part,
      embedText: `${title} — hoja ${sheet.hoja ?? sheet.page}\n${part}`.slice(0, 1800),
      metadata: { source: externalId, doc: title, hoja: sheet.hoja, page: sheet.page, part: partIndex, pipeline: "vision" }
    }))
  );

  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId } },
    update: { title, filePath: `data/sources/${fileName}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount: chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0), metadata: { pipeline: `vision:${VISION_MODEL}+e5-small`, version: "2014-05" } },
    create: { kind: KnowledgeSourceKind.REGULATION, externalId, title, filePath: `data/sources/${fileName}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount: chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0), metadata: { pipeline: `vision:${VISION_MODEL}+e5-small`, version: "2014-05" } }
  });
  await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((chunk, index) => ({ sourceId: source.id, chunkIndex: index, content: chunk.content, tokenEstimate: Math.ceil(chunk.content.length / 4), metadata: chunk.metadata }))
  });

  const stored = await prisma.knowledgeChunk.findMany({ where: { sourceId: source.id }, orderBy: { chunkIndex: "asc" }, select: { id: true } });
  console.log(`${externalId}: ${chunks.length} chunks. Embebiendo...`);
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
  return { externalId, pages: pdf.numPages, chunks: chunks.length, skippedPages: skipped };
}

async function main() {
  const results = [];
  results.push(await ingestPlanilla("planillas-edificacion-2014", "CPU 2014 – Planillas de Edificación", "PLANILLAS DE EDIFICACION 2014.pdf", EDIFICACION_PROMPT));
  results.push(await ingestPlanilla("planillas-uso-suelo-2014", "CPU 2014 – Planillas de Usos del Suelo", "PLANILLAS DE USO 2014.pdf", USO_PROMPT));
  console.log(JSON.stringify({ results }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
