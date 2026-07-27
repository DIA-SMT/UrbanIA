// Sin "server-only" a proposito: lo usa el script de backfill (ingesta de docs)
// que corre por tsx fuera de Next, donde importar "server-only" tira.

import { KnowledgeSourceKind, ProcessingStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { embedPassages } from "@/lib/ai/embeddings";

/**
 * Ingesta de un informe/documento de audiencia a la base de conocimiento, para
 * que Migue lo pueda recuperar (RAG). El archivo ya vive en Storage como
 * HearingDocument; acá se toma su TEXTO ya extraído, se parte en chunks, se
 * embebe con e5-small local y se guarda como KnowledgeSource kind=REPORT.
 *
 * Migue en modo interno recupera REPORT (el filtro publico lo excluye). Si algun
 * dia se quiere abrir a ciudadanos, basta sumar REPORT a PUBLIC_SOURCE_KINDS en
 * lib/ai/rag.ts — el conocimiento ya esta indexado.
 */

const EMBED_BATCH = 32;
const CHUNK_TARGET_CHARS = 1000;
const CHUNK_OVERLAP_CHARS = 150;
/** Tope defensivo del texto crudo guardado en la fuente (un informe es chico). */
const MAX_RAW_TEXT = 200_000;

export type IngestHearingReportInput = {
  hearingId: string;
  documentId: string;
  title: string;
  /** Texto ya extraído y saneado del documento. */
  text: string;
  mimeType?: string | null;
  sourceUrl?: string | null;
  hearingTitle?: string | null;
};

/**
 * Parte texto libre en ventanas de ~1000 chars con solape, respetando parrafos.
 * El solape evita cortar una idea justo en el borde entre dos chunks.
 */
export function chunkReportText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    // Un parrafo enorme se parte duro en trozos del tamano objetivo.
    if (paragraph.length > CHUNK_TARGET_CHARS * 1.8) {
      flush();
      buffer = "";
      for (let start = 0; start < paragraph.length; start += CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS) {
        chunks.push(paragraph.slice(start, start + CHUNK_TARGET_CHARS).trim());
      }
      continue;
    }

    if (buffer && buffer.length + paragraph.length + 2 > CHUNK_TARGET_CHARS) {
      flush();
      const tail = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP_CHARS));
      buffer = `${tail}\n\n${paragraph}`;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }

  flush();
  return chunks.filter((chunk) => chunk.length > 0);
}

/** Escribe los embeddings por SQL crudo: Prisma no puede setear el tipo vector. */
async function embedAndStore(chunkIds: string[], embedTexts: string[]): Promise<void> {
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
  }
}

export async function ingestHearingReport(input: IngestHearingReportInput): Promise<{ sourceId: string; chunks: number }> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("El documento no tiene texto para indexar.");
  }

  const externalId = `hearing-report:${input.documentId}`;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const metadata = {
    pipeline: "pdfjs+e5-small",
    hearingId: input.hearingId,
    hearingTitle: input.hearingTitle ?? null,
    documentId: input.documentId,
    documentTitle: input.title
  };

  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: KnowledgeSourceKind.REPORT, externalId } },
    update: {
      title: input.title,
      sourceUrl: input.sourceUrl ?? null,
      mimeType: input.mimeType ?? null,
      status: ProcessingStatus.PROCESSING,
      rawText: text.slice(0, MAX_RAW_TEXT),
      wordCount,
      metadata
    },
    create: {
      kind: KnowledgeSourceKind.REPORT,
      externalId,
      title: input.title,
      sourceUrl: input.sourceUrl ?? null,
      mimeType: input.mimeType ?? null,
      status: ProcessingStatus.PROCESSING,
      rawText: text.slice(0, MAX_RAW_TEXT),
      wordCount,
      metadata
    }
  });

  try {
    const chunks = chunkReportText(text);
    if (!chunks.length) {
      throw new Error("El documento no produjo fragmentos indexables.");
    }

    // Reindexado limpio: si el documento se re-sube, se reemplazan sus chunks.
    await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });

    for (let start = 0; start < chunks.length; start += 200) {
      const batch = chunks.slice(start, start + 200);
      await prisma.knowledgeChunk.createMany({
        data: batch.map((content, offset) => ({
          sourceId: source.id,
          chunkIndex: start + offset,
          content,
          tokenEstimate: Math.ceil(content.length / 4),
          metadata
        }))
      });
    }

    const stored = await prisma.knowledgeChunk.findMany({
      where: { sourceId: source.id },
      orderBy: { chunkIndex: "asc" },
      select: { id: true, content: true }
    });

    // Se antepone el titulo del informe al texto del chunk: le da contexto al
    // modelo de embedding, igual que en la ingesta del Codigo.
    await embedAndStore(
      stored.map((chunk) => chunk.id),
      stored.map((chunk) => `${input.title}\n${chunk.content}`.slice(0, 1800))
    );

    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: ProcessingStatus.READY, processedAt: new Date() }
    });

    return { sourceId: source.id, chunks: stored.length };
  } catch (error) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: ProcessingStatus.ERROR }
    });
    throw error;
  }
}

/** Borra el conocimiento indexado de un documento (cuando se elimina el adjunto). */
export async function removeHearingReportKnowledge(documentId: string): Promise<void> {
  await prisma.knowledgeSource.deleteMany({
    where: { kind: KnowledgeSourceKind.REPORT, externalId: `hearing-report:${documentId}` }
  });
}
