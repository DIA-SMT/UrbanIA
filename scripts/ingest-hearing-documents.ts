/**
 * Backfill: indexa al conocimiento de Migue los documentos de audiencias que ya
 * estaban subidos antes de que la subida lo hiciera automatico. Descarga cada
 * HearingDocument desde su URL, extrae el texto y lo ingesta como REPORT.
 *
 * Uso:
 *   npm run hearings:ingest-docs            → procesa los que faltan indexar
 *   npm run hearings:ingest-docs -- --all   → reprocesa todos (reemplaza)
 *
 * Solo PDF y TXT (los formatos con texto). El resto se saltea con aviso.
 */

import { prisma } from "@/lib/db/prisma";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { ingestHearingReport } from "@/lib/knowledge/ingest-hearing-report";

const INGESTABLE = [".pdf", ".txt"];

function log(message: string) {
  console.log(`[ingesta-docs] ${message}`);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

async function main() {
  const all = process.argv.includes("--all");

  const documents = await prisma.hearingDocument.findMany({
    where: { url: { not: null } },
    select: {
      id: true,
      name: true,
      url: true,
      type: true,
      hearingRecord: { select: { meetingId: true, meeting: { select: { title: true } } } }
    },
    orderBy: { uploadedAt: "asc" }
  });

  if (!documents.length) {
    log("No hay documentos de audiencias con URL.");
    return;
  }

  // Ya indexados: KnowledgeSource REPORT con externalId hearing-report:<docId>.
  const indexed = new Set(
    (
      await prisma.knowledgeSource.findMany({
        where: { kind: "REPORT", externalId: { startsWith: "hearing-report:" } },
        select: { externalId: true }
      })
    ).map((source) => source.externalId!.replace("hearing-report:", ""))
  );

  let done = 0;
  let skipped = 0;

  for (const doc of documents) {
    const ext = extensionOf(doc.name);
    if (!INGESTABLE.includes(ext)) {
      log(`Salteado (formato ${ext || "sin extension"}): "${doc.name}"`);
      skipped += 1;
      continue;
    }
    if (!all && indexed.has(doc.id)) {
      skipped += 1;
      continue;
    }
    if (!doc.hearingRecord?.meetingId) {
      log(`Salteado (sin audiencia vinculada): "${doc.name}"`);
      skipped += 1;
      continue;
    }

    try {
      log(`Descargando "${doc.name}"...`);
      const response = await fetch(doc.url!);
      if (!response.ok) throw new Error(`HTTP ${response.status} al descargar`);
      const bytes = new Uint8Array(await response.arrayBuffer());

      const text =
        ext === ".pdf"
          ? sanitizePdfText((await extractPdfText(bytes, { maxPages: 200 })).text)
          : sanitizePdfText(new TextDecoder("utf-8").decode(bytes));

      if (text.trim().length < 40) {
        log(`Salteado (sin texto util, quiza escaneado): "${doc.name}"`);
        skipped += 1;
        continue;
      }

      const result = await ingestHearingReport({
        hearingId: doc.hearingRecord.meetingId,
        documentId: doc.id,
        title: doc.name,
        text,
        mimeType: doc.type,
        sourceUrl: doc.url,
        hearingTitle: doc.hearingRecord.meeting?.title ?? null
      });
      log(`Indexado "${doc.name}": ${result.chunks} fragmentos.`);
      done += 1;
    } catch (error) {
      log(`ERROR con "${doc.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log(`Listo. ${done} indexado(s), ${skipped} salteado(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
