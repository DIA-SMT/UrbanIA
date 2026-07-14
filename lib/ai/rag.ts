import "server-only";

import { prisma } from "@/lib/db/prisma";
import { embedQuery, toVectorLiteral } from "@/lib/ai/embeddings";

export type RagChunk = {
  chunkId: string;
  content: string;
  sourceKey: string;
  sourceTitle: string;
  metadata: {
    normLabel?: string;
    heading?: string;
    page?: number;
    articleNumber?: string;
    title?: string;
    hoja?: string;
    [key: string]: unknown;
  };
  score: number;
};

type VectorRow = {
  id: string;
  content: string;
  metadata: unknown;
  source_key: string;
  source_title: string;
  similarity: number;
};

type TextRow = {
  id: string;
  content: string;
  metadata: unknown;
  source_key: string;
  source_title: string;
  rank: number;
};

const RRF_K = 60;

const QUERY_STOP_WORDS = new Set([
  "que", "las", "los", "una", "unos", "unas", "del", "con", "por", "para", "segun", "según",
  "este", "esta", "estos", "estas", "como", "sobre", "entre", "donde", "cual", "cuales",
  "corresponde", "corresponden", "aplica", "aplican", "dice", "dicen", "hay", "tiene", "tienen",
  "puedo", "puede", "pueden", "quiero", "necesito", "cuanto", "cuánto", "cuanta", "cuánta"
]);

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Query full-text con semántica OR: tokens significativos de la pregunta
 * (incluyendo códigos de distrito como C2/R3a) en ambas variantes con/sin tilde.
 * plainto_tsquery exige TODAS las palabras (AND) y falla con preguntas largas.
 */
function buildOrTsQuery(question: string): string | null {
  const rawTokens = question
    .toLowerCase()
    .replace(/[^a-záéíóúüñ0-9\s]/giu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const tokens = new Set<string>();
  for (const token of rawTokens) {
    const isDistrictCode = /^[a-z]{1,2}\d[a-z]?$/.test(token);
    if ((token.length < 3 && !isDistrictCode) || QUERY_STOP_WORDS.has(token)) continue;
    tokens.add(token);
    const plain = stripAccents(token);
    if (plain !== token) tokens.add(plain);
  }

  const list = [...tokens].slice(0, 16);
  return list.length ? list.join(" | ") : null;
}

/**
 * Recuperación híbrida sobre la base documental (KnowledgeChunk):
 * búsqueda vectorial (e5-small + pgvector coseno) y full-text en español,
 * fusionadas con Reciprocal Rank Fusion. Devuelve los mejores `limit` chunks.
 */
export async function retrieveKnowledge(question: string, limit = 8): Promise<RagChunk[]> {
  const fetchCount = Math.max(limit * 2, 12);

  const [vectorRows, textRows] = await Promise.all([
    (async () => {
      const vector = await embedQuery(question);
      return prisma.$queryRawUnsafe<VectorRow[]>(
        `SELECT k.id, k.content, k.metadata, s."externalId" AS source_key, s.title AS source_title,
                1 - (k.embedding <=> $1::vector) AS similarity
         FROM "KnowledgeChunk" k
         JOIN "KnowledgeSource" s ON s.id = k."sourceId"
         WHERE k.embedding IS NOT NULL
         ORDER BY k.embedding <=> $1::vector
         LIMIT $2`,
        toVectorLiteral(vector),
        fetchCount
      );
    })(),
    (async () => {
      const orQuery = buildOrTsQuery(question);
      if (!orQuery) return [] as TextRow[];
      // unaccent en ambos lados: "automoviles" (consulta) debe matchear "Automóviles" (texto).
      return prisma.$queryRawUnsafe<TextRow[]>(
        `SELECT k.id, k.content, k.metadata, s."externalId" AS source_key, s.title AS source_title,
                ts_rank(to_tsvector('spanish', unaccent(k.content)), to_tsquery('spanish', unaccent($1))) AS rank
         FROM "KnowledgeChunk" k
         JOIN "KnowledgeSource" s ON s.id = k."sourceId"
         WHERE to_tsvector('spanish', unaccent(k.content)) @@ to_tsquery('spanish', unaccent($1))
         ORDER BY rank DESC
         LIMIT $2`,
        orQuery,
        fetchCount
      );
    })().catch(() => [] as TextRow[])
  ]);

  const fused = new Map<string, RagChunk>();

  const addRanked = (rows: Array<VectorRow | TextRow>) => {
    rows.forEach((row, index) => {
      const score = 1 / (RRF_K + index + 1);
      const existing = fused.get(row.id);
      if (existing) {
        existing.score += score;
        return;
      }
      fused.set(row.id, {
        chunkId: row.id,
        content: row.content,
        sourceKey: row.source_key,
        sourceTitle: row.source_title,
        metadata: (row.metadata ?? {}) as RagChunk["metadata"],
        score
      });
    });
  };

  addRanked(vectorRows);
  addRanked(textRows);

  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Etiqueta humana de un chunk para citar: "Ordenanza 1681/91 · Digesto 1ª parte, pág. 24". */
export function citeChunk(chunk: RagChunk): string {
  const meta = chunk.metadata;
  if (meta.articleNumber) {
    return `Artículo ${meta.articleNumber} del CPU`;
  }
  const norm = meta.normLabel ?? (meta.hoja ? `Hoja ${meta.hoja}` : meta.heading) ?? "";
  const page = meta.page ? `, pág. ${meta.page}` : "";
  return [norm, `${chunk.sourceTitle}${page}`].filter(Boolean).join(" · ");
}

/** Contexto para el prompt: bloques numerados con su cita. */
export function buildKnowledgeContext(chunks: RagChunk[]): string {
  return chunks
    .map((chunk, index) => `[${index + 1}] ${citeChunk(chunk)}\n${chunk.content}`)
    .join("\n\n---\n\n");
}
