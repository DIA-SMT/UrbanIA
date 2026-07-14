import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KnowledgeSourceKind, Prisma, PrismaClient, ProcessingStatus } from "@prisma/client";
import { embedPassages } from "../lib/ai/embeddings";

/**
 * Ingesta DETERMINÍSTICA de las Planillas de Usos del Suelo (63 hojas).
 * El PDF tiene capa de texto: extraemos cada ítem con sus coordenadas (pdfjs)
 * y asignamos cada marca (*, "200 m2", N.O., #, 1-7) a su fila (actividad) y
 * columna (distrito) por geometría. Sin visión: exacto y auditable.
 */

const prisma = new PrismaClient();
const EXTERNAL_ID = "planillas-uso-suelo-2014";
const TITLE = "CPU 2014 – Planillas de Usos del Suelo";
const FILE_NAME = "PLANILLAS DE USO 2014.pdf";
const EMBED_BATCH = 16;
const CHUNK_MAX_CHARS = 2200;

const DISTRICT_CODES = ["C1a", "C1b", "C2", "C3", "C4a", "C4b", "AE1", "AE2", "AE3", "AE4", "AE5", "R1", "R3a", "R3b", "R4a", "R4b", "R2a", "R2b", "S1", "S2", "I1", "I2"] as const;

type Item = { s: string; x: number; y: number; w: number };
type Column = { key: string; center: number };
type ActivityRow = { name: string; top: number; bottom: number; cells: Map<string, string[]>; notes: string[] };
type TextItem = { str: string; transform: number[]; width?: number };
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }> };

async function loadPdfDoc(filePath: string): Promise<PdfDocument> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  return getDocument({ data, useSystemFonts: true }).promise as unknown as PdfDocument;
}

async function loadPage(pdf: PdfDocument, pageNumber: number): Promise<Item[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return (content.items as TextItem[])
    .filter((item) => typeof item.str === "string" && Boolean(item.str.trim()))
    .map((item) => ({ s: item.str.trim(), x: item.transform[4], y: item.transform[5], w: item.width ?? 0 }));
}

/** Une fragmentos tipo "200" + "m2" contiguos en una sola marca "200 m2". */
function mergeAreaMarks(items: Item[]): Item[] {
  const merged: Item[] = [];
  const used = new Set<number>();
  for (let index = 0; index < items.length; index += 1) {
    if (used.has(index)) continue;
    const current = items[index];
    if (/^\d{2,4}$/.test(current.s)) {
      const partner = items.findIndex(
        (other, otherIndex) =>
          !used.has(otherIndex) &&
          otherIndex !== index &&
          /^m2$/i.test(other.s) &&
          Math.abs(other.y - current.y) <= 4 &&
          other.x >= current.x &&
          other.x - (current.x + current.w) <= 12
      );
      if (partner >= 0) {
        used.add(partner);
        merged.push({ s: `${current.s} m2`, x: current.x, y: current.y, w: current.w + items[partner].w + 2 });
        continue;
      }
    }
    merged.push(current);
  }
  return merged;
}

function detectColumns(items: Item[]): { columns: Column[]; headerBottomY: number } | null {
  const headerItems = items.filter((item) => (DISTRICT_CODES as readonly string[]).includes(item.s));
  const byCode = new Map<string, Item>();
  for (const item of headerItems) {
    // Nos quedamos con la aparición más alta (los códigos también pueden aparecer en notas).
    const existing = byCode.get(item.s);
    if (!existing || item.y > existing.y) byCode.set(item.s, item);
  }
  if (byCode.size < 18) return null;

  const center = (item: Item) => item.x + item.w / 2;
  const columns: Column[] = [];
  const c1a = byCode.get("C1a");
  const c1b = byCode.get("C1b");
  if (c1a && c1b) columns.push({ key: "C1a/C1b", center: (center(c1a) + center(c1b)) / 2 });
  for (const key of ["C2", "C3"]) {
    const item = byCode.get(key);
    if (item) columns.push({ key, center: center(item) });
  }
  const c4a = byCode.get("C4a");
  const c4b = byCode.get("C4b");
  if (c4a && c4b) columns.push({ key: "C4a/C4b", center: (center(c4a) + center(c4b)) / 2 });
  for (const key of ["AE1", "AE2", "AE3", "AE4", "AE5", "R1", "R3a", "R3b", "R4a", "R4b", "R2a", "R2b", "S1", "S2"]) {
    const item = byCode.get(key);
    if (item) columns.push({ key, center: center(item) });
  }
  // S3 a/b: rótulos "a" y "b" entre S2 e I1.
  const s2 = byCode.get("S2");
  const i1 = byCode.get("I1");
  if (s2 && i1) {
    const sub = items.filter(
      (item) => /^[ab]$/.test(item.s) && item.x > s2.x + 4 && item.x < i1.x - 4 && Math.abs(item.y - s2.y) < 30
    );
    for (const item of sub) columns.push({ key: `S3${item.s}`, center: center(item) });
  }
  for (const key of ["I1", "I2"]) {
    const item = byCode.get(key);
    if (item) columns.push({ key, center: center(item) });
  }

  // Restamos 16 para excluir sub-rótulos del encabezado (a/b de S3, "(+++)" de AE3).
  const headerBottomY = Math.min(...[...byCode.values()].map((item) => item.y)) - 16;
  columns.sort((a, b) => a.center - b.center);
  return { columns, headerBottomY };
}

function extractSheet(items: Item[], pageNumber: number): { hoja: string | null; text: string } | null {
  const merged = mergeAreaMarks(items);
  const detected = detectColumns(merged);
  if (!detected) return null;
  const { columns, headerBottomY } = detected;
  const firstColumnX = Math.min(...columns.map((column) => column.center));

  // "hoja 3 / 63" puede venir partida en ítems; buscamos el patrón n/m más alto de la página.
  const hojaItem = merged
    .filter((item) => /^\d{1,2}\s*\/\s*\d{2}$/.test(item.s) || /hoja\s*\d+\s*\/\s*\d+/i.test(item.s))
    .sort((a, b) => b.y - a.y)[0];
  const hoja = hojaItem?.s.match(/(\d+)\s*\/\s*(\d+)/)?.slice(1).join("/") ?? null;

  // Leyenda/pie: todo lo que esté debajo de la última actividad se trata como notas.
  const legendTop = merged
    .filter((item) => /permitido sin restricciones/i.test(item.s))
    .reduce((max, item) => Math.max(max, item.y), 0);

  const lastColumnX = Math.max(...columns.map((column) => column.center));
  const estCenter = lastColumnX + 30; // Estacionamiento queda a la derecha de I2.

  // Marcas de celda dentro de la grilla de distritos (definen los y de cada fila).
  const gridMarks = merged.filter((item) => {
    const centerX = item.x + item.w / 2;
    return centerX > firstColumnX - 14 && centerX < lastColumnX + 12 && item.y < headerBottomY && item.y > legendTop + 8;
  });

  // Cada fila de la grilla tiene un y propio: clusterizamos los y de las marcas.
  const rowYs: number[] = [];
  for (const mark of gridMarks) {
    if (!rowYs.some((y) => Math.abs(y - mark.y) <= 3)) rowYs.push(mark.y);
  }
  rowYs.sort((a, b) => b - a);
  if (!rowYs.length) return null;

  const rows: ActivityRow[] = rowYs.map((y) => ({ name: "", top: y, bottom: y, cells: new Map(), notes: [] }));
  const nearestRow = (y: number, tolerance: number) => {
    let best: ActivityRow | null = null;
    let bestDistance = tolerance;
    for (const row of rows) {
      const distance = Math.abs(row.top - y);
      if (distance < bestDistance) {
        best = row;
        bestDistance = distance;
      }
    }
    return best;
  };

  // Etiquetas de actividad (columna izquierda): cada línea se asigna a la fila
  // (y de marcas) más cercana; las que quedan lejos son títulos de sección.
  const labelItems = merged
    .filter(
      (item) =>
        item.x < firstColumnX - 24 &&
        item.y < headerBottomY &&
        item.y > legendTop + 8 &&
        !/^nota/i.test(item.s) &&
        !/^direcci/i.test(item.s)
    )
    .sort((a, b) => b.y - a.y);
  // Nombres multilínea: continúa si la línea empieza en minúscula/paréntesis, si la
  // anterior quedó abierta (coma o paréntesis sin cerrar), o si ambas son títulos en mayúsculas.
  const isAllCaps = (text: string) => text.length > 3 && !/[a-záéíóúüñ]/.test(text);
  const endsOpen = (text: string) => /,\s*$/.test(text) || (text.match(/\(/g) ?? []).length > (text.match(/\)/g) ?? []).length;
  const labelGroups: Item[][] = [];
  for (const label of labelItems) {
    const current = labelGroups[labelGroups.length - 1];
    const previous = current?.[current.length - 1];
    const isContinuation =
      previous &&
      previous.y - label.y <= 14 &&
      (/^[a-záéíóúüñ(]/.test(label.s) || endsOpen(previous.s) || (isAllCaps(previous.s) && isAllCaps(label.s)));
    if (isContinuation) current.push(label);
    else labelGroups.push([label]);
  }

  const sectionHeaders: Array<{ y: number; text: string }> = [];
  for (const group of labelGroups) {
    const text = group.map((item) => item.s).join(" ").replace(/\s+/g, " ").trim();
    // Las marcas se alinean exactamente con UNA de las líneas del nombre.
    let row: ActivityRow | null = null;
    for (const line of group) {
      row = rows.find((candidate) => Math.abs(candidate.top - line.y) <= 3) ?? null;
      if (row) break;
    }
    if (!row) {
      const centerY = (group[0].y + group[group.length - 1].y) / 2;
      row = nearestRow(centerY, 16);
    }
    if (row) row.name = row.name ? `${row.name} ${text}` : text;
    else sectionHeaders.push({ y: group[0].y, text });
  }

  // Celdas de distrito.
  for (const mark of gridMarks) {
    const row = nearestRow(mark.y, 4);
    if (!row) continue;
    const markCenter = mark.x + mark.w / 2;
    let best: Column | null = null;
    let bestDistance = 11;
    for (const column of columns) {
      const distance = Math.abs(markCenter - column.center);
      if (distance < bestDistance) {
        best = column;
        bestDistance = distance;
      }
    }
    if (best) row.cells.set(best.key, [...(row.cells.get(best.key) ?? []), mark.s]);
  }

  // Estacionamiento y observaciones (a la derecha de la grilla).
  const rightMarks = merged.filter((item) => {
    const centerX = item.x + item.w / 2;
    return centerX >= lastColumnX + 12 && item.y < headerBottomY && item.y > legendTop + 8;
  });
  for (const mark of rightMarks) {
    const row = nearestRow(mark.y, 10);
    if (!row) continue;
    const centerX = mark.x + mark.w / 2;
    if (Math.abs(centerX - estCenter) <= 25 && /^(N\.?O\.?$|[1-7]$|#)/.test(mark.s)) {
      row.cells.set("EST", [...(row.cells.get("EST") ?? []), mark.s]);
    } else {
      row.notes.push(mark.s);
    }
  }

  // Observaciones y notas al pie.
  const footNotes = merged
    .filter((item) => item.y <= legendTop + 8 || /^nota/i.test(item.s))
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.s)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Intercalamos títulos de sección (ej. "COMERCIO MINORISTA") según su posición vertical.
  type Entry = { y: number; text: string };
  const entries: Entry[] = sectionHeaders.map((header) => ({
    y: header.y,
    // Mayúsculas puras = título de rubro; caso mixto sin marcas = actividad no permitida en ningún distrito.
    text: isAllCaps(header.text)
      ? `### ${header.text}`
      : `## ${header.text}\n- No permitido en ningún distrito de la hoja (sin marcas en la planilla)`
  }));

  for (const row of rows) {
    if (!row.name) continue;
    const allowed: string[] = [];
    const limited: string[] = [];
    const other: string[] = [];
    for (const column of columns) {
      const values = row.cells.get(column.key);
      if (!values?.length) continue;
      const value = values.join(" ");
      if (value === "*") allowed.push(column.key);
      else if (/m2/i.test(value)) limited.push(`${column.key}: hasta ${value.replace(/\*/g, "").trim()}`);
      else other.push(`${column.key}: ${value}`);
    }
    const lines = [`## ${row.name}`];
    if (allowed.length) lines.push(`- Permitido sin restricciones en: ${allowed.join(", ")}`);
    if (limited.length) lines.push(`- Permitido con límite en: ${limited.join(", ")}`);
    if (other.length) lines.push(`- Otras marcas: ${other.join(", ")}`);
    lines.push(`- No permitido en: resto de los distritos de la hoja`);
    const est = row.cells.get("EST");
    if (est?.length) lines.push(`- Estacionamiento/carga: ${[...new Set(est)].join(" ")}`);
    if (row.notes.length) lines.push(`- Notas de la fila: ${row.notes.join(" ")}`);
    entries.push({ y: row.top, text: lines.join("\n") });
  }

  entries.sort((a, b) => b.y - a.y);
  const sections: string[] = [`HOJA: ${hoja ?? `${pageNumber}/63`}`, ...entries.map((entry) => entry.text)];
  if (footNotes) sections.push(`NOTAS DE LA HOJA: ${footNotes}`);

  return { hoja, text: sections.join("\n\n") };
}

function splitTranscript(text: string): string[] {
  if (text.length <= CHUNK_MAX_CHARS) return [text];
  const header = text.split(/\n\n(?=## )/)[0];
  const sections = text.split(/\n\n(?=## )/).slice(1);
  const parts: string[] = [];
  let current = header;
  for (const section of sections) {
    if ((current + "\n\n" + section).length > CHUNK_MAX_CHARS && current.trim()) {
      parts.push(current.trim());
      current = `${header.split("\n")[0]}\n\n${section}`;
    } else {
      current += `\n\n${section}`;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function main() {
  const pdfPath = join(process.cwd(), "data", "sources", FILE_NAME);
  const pdf = await loadPdfDoc(pdfPath);
  // DRY_PAGES=3,10 imprime la extracción de esas páginas sin tocar la base.
  const dryPages = process.env.DRY_PAGES?.split(",").map(Number).filter(Boolean);
  console.log(`${EXTERNAL_ID}: ${pdf.numPages} páginas (extracción geométrica, sin visión)...`);

  const sheets: Array<{ page: number; hoja: string | null; text: string }> = [];
  const failed: number[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (dryPages && !dryPages.includes(pageNumber)) continue;
    const items = await loadPage(pdf, pageNumber);
    const sheet = extractSheet(items, pageNumber);
    if (!sheet) {
      failed.push(pageNumber);
      console.warn(`  p${pageNumber}: estructura no reconocida, OMITIDA`);
      continue;
    }
    sheets.push({ page: pageNumber, ...sheet });
    console.log(`  p${pageNumber}/${pdf.numPages} ok (hoja ${sheet.hoja ?? "?"}, ${sheet.text.length} chars)`);
  }

  if (dryPages) {
    for (const sheet of sheets) console.log(`\n===== p${sheet.page} =====\n${sheet.text}`);
    return;
  }

  const chunks = sheets.flatMap((sheet) =>
    splitTranscript(sheet.text).map((part, partIndex) => ({
      content: part,
      embedText: `${TITLE} — hoja ${sheet.hoja ?? sheet.page}\n${part}`.slice(0, 1800),
      metadata: { source: EXTERNAL_ID, doc: TITLE, hoja: sheet.hoja, page: sheet.page, part: partIndex, pipeline: "geometry" } as Prisma.InputJsonValue
    }))
  );

  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId: EXTERNAL_ID } },
    update: { title: TITLE, filePath: `data/sources/${FILE_NAME}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount: chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0), metadata: { pipeline: "pdfjs-geometry+e5-small", version: "2014-05" } },
    create: { kind: KnowledgeSourceKind.REGULATION, externalId: EXTERNAL_ID, title: TITLE, filePath: `data/sources/${FILE_NAME}`, mimeType: "application/pdf", status: ProcessingStatus.PROCESSING, wordCount: chunks.reduce((sum, chunk) => sum + chunk.content.split(/\s+/).length, 0), metadata: { pipeline: "pdfjs-geometry+e5-small", version: "2014-05" } }
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
  console.log(JSON.stringify({ externalId: EXTERNAL_ID, pages: pdf.numPages, sheets: sheets.length, chunks: chunks.length, failedPages: failed }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
