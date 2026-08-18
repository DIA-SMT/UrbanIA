// Sin "server-only" a proposito: lo usa el script de backfill (ingesta de docs)
// que corre por tsx fuera de Next, donde importar "server-only" tira.

import { KnowledgeSourceKind, ProcessingStatus, Prisma } from "@prisma/client";

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

/**
 * Núcleo compartido: parte el texto, lo embebe y lo guarda como una fuente de
 * conocimiento (upsert por kind+externalId, con reindexado limpio). Lo usan el
 * informe adjunto (REPORT) y la transcripción de la audiencia (MEETING).
 */
async function storeKnowledgeSource(input: {
  kind: KnowledgeSourceKind;
  externalId: string;
  title: string;
  text: string;
  mimeType?: string | null;
  sourceUrl?: string | null;
  metadata: Prisma.InputJsonValue;
}): Promise<{ sourceId: string; chunks: number }> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("No hay texto para indexar.");
  }
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const source = await prisma.knowledgeSource.upsert({
    where: { kind_externalId: { kind: input.kind, externalId: input.externalId } },
    update: {
      title: input.title,
      sourceUrl: input.sourceUrl ?? null,
      mimeType: input.mimeType ?? null,
      status: ProcessingStatus.PROCESSING,
      rawText: text.slice(0, MAX_RAW_TEXT),
      wordCount,
      metadata: input.metadata
    },
    create: {
      kind: input.kind,
      externalId: input.externalId,
      title: input.title,
      sourceUrl: input.sourceUrl ?? null,
      mimeType: input.mimeType ?? null,
      status: ProcessingStatus.PROCESSING,
      rawText: text.slice(0, MAX_RAW_TEXT),
      wordCount,
      metadata: input.metadata
    }
  });

  // Solo pasa a true una vez que se borraron los chunks viejos: a partir de ahi
  // un fallo deja la fuente a medio escribir y hay que limpiarla (ver el catch).
  // Antes de ese punto, lo que hay guardado es el indice ANTERIOR, que funciona.
  let chunksReemplazados = false;

  try {
    const chunks = chunkReportText(text);
    if (!chunks.length) {
      throw new Error("El texto no produjo fragmentos indexables.");
    }

    // Reindexado limpio: si la fuente se re-ingesta, se reemplazan sus chunks.
    await prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    chunksReemplazados = true;

    for (let start = 0; start < chunks.length; start += 200) {
      const batch = chunks.slice(start, start + 200);
      await prisma.knowledgeChunk.createMany({
        data: batch.map((content, offset) => ({
          sourceId: source.id,
          chunkIndex: start + offset,
          content,
          tokenEstimate: Math.ceil(content.length / 4),
          metadata: input.metadata
        }))
      });
    }

    const stored = await prisma.knowledgeChunk.findMany({
      where: { sourceId: source.id },
      orderBy: { chunkIndex: "asc" },
      select: { id: true, content: true }
    });

    // Se antepone el título al texto del chunk: le da contexto al modelo de
    // embedding, igual que en la ingesta del Código.
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
    /*
     * Los fragmentos se escriben ANTES de embeberlos, asi que un fallo en el
     * embedding los dejaba guardados sin vector. Eso no es "medio indexado": la
     * pata vectorial filtra por `embedding IS NOT NULL`, asi que esos fragmentos
     * son invisibles para la busqueda semantica, pero la pata de texto SI los
     * devuelve. El documento queda respondiendo distinto que todos los demas,
     * sin que nada lo indique. Le paso al PPT de la Comision FAU: 27 fragmentos
     * fantasma desde el 2026-07-31 hasta que una auditoria los encontro.
     *
     * Se limpian para que el estado sea honesto: la fuente queda en ERROR y sin
     * fragmentos, que es lo que el backfill busca para reprocesarla.
     */
    if (chunksReemplazados) {
      await prisma.knowledgeChunk
        .deleteMany({ where: { sourceId: source.id } })
        .catch((cleanupError) =>
          console.error(`[conocimiento] No se pudieron limpiar los fragmentos de "${input.title}":`, cleanupError)
        );
    }
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: ProcessingStatus.ERROR }
    });
    throw error;
  }
}

export async function ingestHearingReport(input: IngestHearingReportInput): Promise<{ sourceId: string; chunks: number }> {
  return storeKnowledgeSource({
    kind: KnowledgeSourceKind.REPORT,
    externalId: `hearing-report:${input.documentId}`,
    title: input.title,
    text: input.text,
    mimeType: input.mimeType,
    sourceUrl: input.sourceUrl,
    metadata: {
      pipeline: "pdfjs+e5-small",
      hearingId: input.hearingId,
      hearingTitle: input.hearingTitle ?? null,
      documentId: input.documentId,
      documentTitle: input.title
    }
  });
}

/** Fecha en formato "27 de mayo de 2026" (o null si no hay). */
function formatHearingDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/**
 * Indexa la TRANSCRIPCIÓN de una audiencia para el conocimiento de Migue. Lee
 * los segmentos ya guardados y los ingesta como fuente MEETING. Cubre todas las
 * fuentes (TXT, PDF, YouTube, audio), porque todas terminan como segmentos.
 * Devuelve null si la audiencia no tiene transcripción con texto suficiente.
 *
 * El título de la fuente lleva la FECHA de la ficha: es lo que Migue ve al citar
 * (via citeChunk), y la fecha es la referencia para distinguir y ordenar las
 * audiencias mientras no haya un número canónico.
 */
export async function ingestHearingTranscript(meetingId: string): Promise<{ sourceId: string; chunks: number } | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, kind: "PUBLIC_HEARING" },
    select: {
      title: true,
      occurredAt: true,
      hearingRecord: { select: { mainTopic: true } },
      transcriptSegments: { orderBy: { startMs: "asc" }, select: { speakerLabel: true, content: true } }
    }
  });
  if (!meeting) return null;

  const text = meeting.transcriptSegments
    .map((segment) => (segment.speakerLabel ? `${segment.speakerLabel}: ${segment.content}` : segment.content))
    .join("\n")
    .trim();
  if (text.length < 40) return null;

  const fecha = formatHearingDate(meeting.occurredAt);
  // La fecha primero: asi cada cita ("Audiencia del 27 de mayo de 2026 — ...")
  // le dice a Migue de que audiencia sale el dato y en que orden cronologico va.
  const label = `Audiencia pública${fecha ? ` del ${fecha}` : ""} — ${meeting.title}`;
  const topic = meeting.hearingRecord?.mainTopic?.trim();

  return storeKnowledgeSource({
    kind: KnowledgeSourceKind.MEETING,
    externalId: `hearing-transcript:${meetingId}`,
    title: label,
    // Encabezado con fecha y tema al inicio del texto: mejora la recuperacion
    // cuando alguien pregunta por "la audiencia del 27 de mayo" o por un tema.
    text: `${label}.${topic ? ` Tema: ${topic}.` : ""}\n\n${text}`,
    metadata: {
      pipeline: "transcript+e5-small",
      hearingId: meetingId,
      hearingTitle: meeting.title,
      hearingDate: meeting.occurredAt?.toISOString() ?? null,
      mainTopic: topic ?? null,
      segments: meeting.transcriptSegments.length
    }
  });
}

/** Borra el conocimiento indexado de un documento (cuando se elimina el adjunto). */
export async function removeHearingReportKnowledge(documentId: string): Promise<void> {
  await prisma.knowledgeSource.deleteMany({
    where: { kind: KnowledgeSourceKind.REPORT, externalId: `hearing-report:${documentId}` }
  });
}

/** Borra la transcripción indexada de una audiencia (cuando se elimina la audiencia). */
export async function removeHearingTranscriptKnowledge(meetingId: string): Promise<void> {
  await prisma.knowledgeSource.deleteMany({
    where: { kind: KnowledgeSourceKind.MEETING, externalId: `hearing-transcript:${meetingId}` }
  });
}
