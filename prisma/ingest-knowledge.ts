import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KnowledgeSourceKind, Prisma, PrismaClient, ProcessingStatus } from "@prisma/client";
import { embedPassages } from "../lib/ai/embeddings";

/**
 * Ingesta RAG de la normativa en PDF (texto ya extraído con pdftotext a data/extracted):
 *  - Digesto Normativo 1ª y 2ª parte, EDICIÓN 2015 (quinta actualización): se
 *    parte por norma (ordenanza/decreto/ley/resolución). La edición anterior se
 *    elimina al final: el RAG cita una sola edición vigente, no dos.
 *  - Anexo de Ordenanzas del Texto CPU 2014: ordenanzas completas no intercalables.
 *  - Re-embebe los chunks estructurados del CPU ya existentes (fuente codigo-planeamiento-smt-2014).
 * Embeddings locales multilingual-e5-small (384 dim) sobre la columna pgvector.
 *
 * Cuando llegue la próxima edición del digesto: extraer con
 *   pdftotext -enc UTF-8 <pdf> data/extracted/digesto-N-AAAA.raw.txt
 * y actualizar las entradas de main() (archivos, externalId, versión y la lista
 * de ediciones a eliminar).
 */

const prisma = new PrismaClient();

const CHUNK_MAX_CHARS = 1400;
const CHUNK_OVERLAP_CHARS = 200;
const EMBED_BATCH = 16;

const PAGE_HEADER = /Direcci[oó]n de Catastro y Edificaci[oó]n\s*[–-]\s*Digesto Normativo/iu;
const NORM_HEADING = /^(ORDENANZA(?:\s+GENERAL\s+DE\s+CONSTRUCCIONES)?|DECRETO(?:\s+ACUERDO)?(?:\s+PROVINCIAL)?|RESOLUCI[ÓO]N(?:\s+GENERAL)?|LEY(?:\s+PROVINCIAL|\s+NACIONAL)?)\s+N[º°.]?\s*(\d[\d.]*(?:\s*(?:bis|ter))?(?:\/[\w.-]+)*)/iu;

type CleanPage = { page: number; text: string };
type NormSection = { normType: string; normId: string; heading: string; body: string; page: number };
type PreparedChunk = { content: string; embedText: string; metadata: Prisma.InputJsonValue };

/**
 * En algunas páginas pdftotext pega el encabezado y el título de la norma en la
 * MISMA línea ("...mayo de 2015) RESOLUCIÓN Nº 227..."). Filtrar la línea entera
 * se comía esa norma (pasaba en ambas ediciones: 9 líneas en 2014, 13 en 2015).
 * Por eso primero se recorta el prefijo del encabezado y el filtro queda solo
 * para las líneas que son encabezado puro.
 */
const PAGE_HEADER_PREFIX = /^.*?Digesto Normativo.*?\(Extractado y ordenado a mayo de \d{4}\)\s*/iu;

function cleanPages(raw: string): CleanPage[] {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\f")
    .map((pageText, index) => ({
      page: index + 1,
      text: pageText
        .split("\n")
        .map((line) => (PAGE_HEADER.test(line) ? line.replace(PAGE_HEADER_PREFIX, "") : line))
        .filter((line) => !PAGE_HEADER.test(line) && !/^\s*\d{1,3}\s*$/.test(line))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    }))
    .filter((entry) => entry.text.length > 0);
}

function splitByNorms(pages: CleanPage[]): NormSection[] {
  const sections: NormSection[] = [];
  let current: NormSection | null = null;

  for (const { page, text } of pages) {
    for (const line of text.split("\n")) {
      const match = line.match(NORM_HEADING);
      if (match) {
        if (current && current.body.trim().length > 60) sections.push(current);
        const normType = match[1].replace(/\s+/g, " ").trim();
        const normId = match[2].trim();
        current = {
          normType,
          normId,
          heading: line.trim().slice(0, 160),
          body: `${line.trim()}\n`,
          page
        };
        continue;
      }
      if (current) current.body += `${line}\n`;
    }
  }
  if (current && current.body.trim().length > 60) sections.push(current);
  return sections;
}

function sizeSplit(text: string): string[] {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= CHUNK_MAX_CHARS) return [clean];
  const parts: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_MAX_CHARS, clean.length);
    if (end < clean.length) {
      // Cortamos en el último salto de párrafo/oración dentro de la ventana para no partir ideas.
      const window = clean.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "));
      if (breakAt > CHUNK_MAX_CHARS * 0.5) end = start + breakAt + 1;
    }
    parts.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }
  return parts.filter((part) => part.length > 40);
}

/**
 * El Anexo I del Decreto 0582/SPDUA/00 (Inventario de Edificios y Sitios de
 * Valor Patrimonial) es una TABLA que pdftotext lee por columnas: quedan todos
 * los nombres juntos, despues todas las direcciones, despues los propietarios.
 * Chunkeado asi, el RAG asociaria cada edificio con la direccion de otro. Se
 * corta aca y la tabla entra bien por prisma/ingest-inventario-patrimonio.ts,
 * que la transcribe con vision igual que las planillas.
 */
const ANEXO_INVENTARIO = /\n\s*ANEXO I\s*\n+\s*INVENTARIO EDIFICIOS[\s\S]*$/u;

function prepareDocumentChunks(sections: NormSection[], docLabel: string, externalId: string): PreparedChunk[] {
  const chunks: PreparedChunk[] = [];
  for (const section of sections) {
    const normLabel = `${titleCase(section.normType)} ${section.normId}`;
    const body = section.body.replace(
      ANEXO_INVENTARIO,
      "\n[Anexo I: el Inventario de Edificios y Sitios de Valor Patrimonial está cargado como fuente aparte, transcripto del PDF original.]"
    );
    const parts = sizeSplit(body);
    parts.forEach((part, partIndex) => {
      chunks.push({
        content: part,
        embedText: `${normLabel} — ${docLabel}\n${part}`.slice(0, 1800),
        metadata: {
          source: externalId,
          doc: docLabel,
          normType: titleCase(section.normType),
          normId: section.normId,
          normLabel,
          heading: section.heading,
          page: section.page,
          part: partIndex,
          parts: parts.length
        }
      });
    });
  }
  return chunks;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

async function upsertSource(externalId: string, title: string, filePath: string, wordCount: number, version: string) {
  return prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId } },
    update: { title, filePath, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount, metadata: { pipeline: "pdftotext+e5-small", version } },
    create: { kind: KnowledgeSourceKind.REGULATION, externalId, title, filePath, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount, metadata: { pipeline: "pdftotext+e5-small", version } }
  });
}

/** Elimina una fuente reemplazada (edición vieja) con todos sus chunks. */
async function removeSource(externalId: string) {
  const source = await prisma.knowledgeSource.findUnique({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId } }
  });
  if (!source) return { externalId, removed: false };
  const { count } = await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
  await prisma.knowledgeSource.delete({ where: { id: source.id } });
  console.log(`${externalId}: eliminada (${count} chunks).`);
  return { externalId, removed: true, chunks: count };
}

async function embedAndStore(chunkIds: string[], embedTexts: string[]) {
  for (let start = 0; start < chunkIds.length; start += EMBED_BATCH) {
    const idsBatch = chunkIds.slice(start, start + EMBED_BATCH);
    const vectors = await embedPassages(embedTexts.slice(start, start + EMBED_BATCH));
    const literals = vectors.map((vector) => `[${vector.join(",")}]`);
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeChunk" AS k SET embedding = v.emb::vector
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS emb) AS v
       WHERE k.id = v.id`,
      idsBatch,
      literals
    );
    if ((start / EMBED_BATCH) % 10 === 0) {
      console.log(`  embeddings ${Math.min(start + EMBED_BATCH, chunkIds.length)}/${chunkIds.length}`);
    }
  }
}

async function ingestDocument(externalId: string, title: string, filePath: string, rawPath: string, version: string, options?: { fromMarker?: RegExp }) {
  const raw = await readFile(rawPath, "utf8");
  let pages = cleanPages(raw);

  if (options?.fromMarker) {
    // Nos quedamos desde la última página que contiene el marcador (ej. ANEXO DE ORDENANZAS).
    const startIndex = pages.reduce((found, entry, index) => (options.fromMarker!.test(entry.text) ? index : found), -1);
    if (startIndex >= 0) pages = pages.slice(startIndex);
  }

  const sections = splitByNorms(pages);
  const chunks = prepareDocumentChunks(sections, title, externalId);
  if (!chunks.length) throw new Error(`Sin chunks para ${externalId}`);

  const wordCount = pages.reduce((sum, page) => sum + page.text.split(/\s+/).length, 0);
  const source = await upsertSource(externalId, title, filePath, wordCount, version);
  await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });

  // createMany en lotes para no exceder límites del pooler.
  for (let start = 0; start < chunks.length; start += 200) {
    const batch = chunks.slice(start, start + 200);
    await prisma.knowledgeChunk.createMany({
      data: batch.map((chunk, offset) => ({
        sourceId: source.id,
        chunkIndex: start + offset,
        content: chunk.content,
        tokenEstimate: Math.ceil(chunk.content.length / 4),
        metadata: chunk.metadata
      }))
    });
  }

  const stored = await prisma.knowledgeChunk.findMany({ where: { sourceId: source.id }, orderBy: { chunkIndex: "asc" }, select: { id: true } });
  console.log(`${externalId}: ${sections.length} normas → ${chunks.length} chunks. Embebiendo...`);
  await embedAndStore(stored.map((chunk) => chunk.id), chunks.map((chunk) => chunk.embedText));

  await prisma.knowledgeSource.update({ where: { id: source.id }, data: { status: ProcessingStatus.READY, processedAt: new Date() } });
  return { externalId, sections: sections.length, chunks: chunks.length };
}

async function reembedPlanningCode() {
  const source = await prisma.knowledgeSource.findUnique({ where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId: "codigo-planeamiento-smt-2014" } } });
  if (!source) {
    console.warn("Fuente del CPU estructurado no encontrada; se omite el re-embed.");
    return { externalId: "codigo-planeamiento-smt-2014", sections: 0, chunks: 0 };
  }
  const chunks = await prisma.knowledgeChunk.findMany({ where: { sourceId: source.id }, orderBy: { chunkIndex: "asc" }, select: { id: true, content: true, metadata: true } });
  const embedTexts = chunks.map((chunk) => {
    const meta = (chunk.metadata ?? {}) as { articleNumber?: string; title?: string };
    const label = meta.articleNumber ? `Artículo ${meta.articleNumber} — ${meta.title ?? ""} — Código de Planeamiento Urbano` : "Código de Planeamiento Urbano";
    return `${label}\n${chunk.content}`.slice(0, 1800);
  });
  console.log(`codigo-planeamiento-smt-2014: re-embebiendo ${chunks.length} chunks...`);
  await embedAndStore(chunks.map((chunk) => chunk.id), embedTexts);
  await prisma.knowledgeSource.update({ where: { id: source.id }, data: { status: ProcessingStatus.READY, processedAt: new Date() } });
  return { externalId: "codigo-planeamiento-smt-2014", sections: chunks.length, chunks: chunks.length };
}

async function main() {
  const extracted = join(process.cwd(), "data", "extracted");
  const results = [];

  // Sin argumentos corre todo. Con argumentos, solo esas fuentes:
  //   npx tsx --env-file=.env.local prisma/ingest-knowledge.ts digesto-catastro-1-2015
  const soloIds = process.argv.slice(2);
  const corre = (externalId: string) => soloIds.length === 0 || soloIds.includes(externalId);

  if (corre("codigo-planeamiento-smt-2014")) results.push(await reembedPlanningCode());
  if (corre("digesto-catastro-1-2015")) {
    results.push(await ingestDocument("digesto-catastro-1-2015", "Digesto Normativo 1ª parte (mayo 2015)", "data/sources/digesto-1-2015.pdf", join(extracted, "digesto-1-2015.raw.txt"), "2015-05"));
    // El reemplazo borra la edición anterior recién DESPUÉS de ingerir la nueva:
    // si la ingesta falla a mitad de camino, el RAG sigue citando el digesto 2014.
    results.push(await removeSource("digesto-catastro-1-2014"));
  }
  if (corre("digesto-catastro-2-2015")) {
    results.push(await ingestDocument("digesto-catastro-2-2015", "Digesto Normativo 2ª parte (mayo 2015)", "data/sources/digesto-2-2015.pdf", join(extracted, "digesto-2-2015.raw.txt"), "2015-05"));
    results.push(await removeSource("digesto-catastro-2-2014"));
  }
  if (corre("cpu-anexo-ordenanzas-2014")) {
    results.push(await ingestDocument("cpu-anexo-ordenanzas-2014", "CPU 2014 – Anexo de Ordenanzas", "data/sources/TEXTO CPU 2014-para web.pdf", join(extracted, "texto-cpu-2014.raw.txt"), "2014-05", { fromMarker: /^ANEXO DE ORDENANZAS$/m }));
  }

  const total = await prisma.knowledgeChunk.count();
  const withEmbedding = await prisma.$queryRawUnsafe<[{ n: number }]>(`select count(*)::int as n from "KnowledgeChunk" where embedding is not null`);
  console.log(JSON.stringify({ results, totalChunks: total, withEmbedding: withEmbedding[0].n }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
