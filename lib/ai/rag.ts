import "server-only";

import { prisma } from "@/lib/db/prisma";
import { embedQuery, toVectorLiteral } from "@/lib/ai/embeddings";
import type { MigueMode } from "@/lib/ai/migue";

/**
 * RAG normativo de UrbanIA. Dos capas:
 *
 * 1) Motor de recuperación (local, gratis): embeddings multilingual-e5-small
 *    (384 dims) + full-text español con unaccent, fusionados con Reciprocal
 *    Rank Fusion sobre KnowledgeChunk/pgvector. Lo usa el chat de Consulta al
 *    CPU y la capa de Migue.
 *
 * 2) Capa de respuesta verificable (contrato de Migue): el modelo debe devolver
 *    JSON {answer, cita} y la cita textual se localiza en los fragmentos para
 *    resaltarla en la UI. Si la cita no se encuentra, nunca se resalta nada.
 */

// ============================================================================
// Capa 1 — Recuperación híbrida
// ============================================================================

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
  /** Similitud coseno si el chunk vino de la búsqueda vectorial. */
  vectorSimilarity?: number;
  /** true si el chunk también matcheó por full-text (señal fuerte de pertinencia). */
  textMatch?: boolean;
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

// En modo público solo se recupera de fuentes públicas. Actas, reportes internos,
// archivos y notas quedan reservados a personal municipal. El filtro va en la
// query (no solo en el prompt) para que la info interna nunca llegue al modelo.
const PUBLIC_SOURCE_KINDS = ["REGULATION", "WEB_PAGE"];

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
export async function retrieveKnowledge(
  question: string,
  limit = 8,
  options: { publicOnly?: boolean } = {}
): Promise<RagChunk[]> {
  const fetchCount = Math.max(limit * 2, 12);
  const kindFilter = options.publicOnly
    ? `AND s."kind"::text IN (${PUBLIC_SOURCE_KINDS.map((kind) => `'${kind}'`).join(", ")})`
    : "";

  const [vectorRows, textRows] = await Promise.all([
    (async () => {
      const vector = await embedQuery(question);
      return prisma.$queryRawUnsafe<VectorRow[]>(
        `SELECT k.id, k.content, k.metadata, s."externalId" AS source_key, s.title AS source_title,
                1 - (k.embedding <=> $1::vector) AS similarity
         FROM "KnowledgeChunk" k
         JOIN "KnowledgeSource" s ON s.id = k."sourceId"
         WHERE k.embedding IS NOT NULL
         ${kindFilter}
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
         ${kindFilter}
         ORDER BY rank DESC
         LIMIT $2`,
        orQuery,
        fetchCount
      );
    })().catch(() => [] as TextRow[])
  ]);

  const fused = new Map<string, RagChunk>();

  const addRanked = (rows: Array<VectorRow | TextRow>, kind: "vector" | "text") => {
    rows.forEach((row, index) => {
      const score = 1 / (RRF_K + index + 1);
      const existing = fused.get(row.id);
      if (existing) {
        existing.score += score;
        if (kind === "vector") existing.vectorSimilarity = (row as VectorRow).similarity;
        if (kind === "text") existing.textMatch = true;
        return;
      }
      fused.set(row.id, {
        chunkId: row.id,
        content: row.content,
        sourceKey: row.source_key,
        sourceTitle: row.source_title,
        metadata: (row.metadata ?? {}) as RagChunk["metadata"],
        score,
        vectorSimilarity: kind === "vector" ? (row as VectorRow).similarity : undefined,
        textMatch: kind === "text" ? true : undefined
      });
    });
  };

  addRanked(vectorRows, "vector");
  addRanked(textRows, "text");

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

// ============================================================================
// Capa 2 — Respuesta verificable de Migue (contrato JSON + cita resaltable)
// ============================================================================

export type RagFragment = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  reference: string | null;
  title: string | null;
  content: string;
  similarity: number;
};

export type RagSource = {
  chunkId: string;
  title: string;
  reference: string | null;
  excerpt: string;
  similarity: number;
};

export type RagRetrieval = {
  fragments: RagFragment[];
  sources: RagSource[];
  hasEvidence: boolean;
};

/**
 * Fuente única que se muestra en la UI: el documento principal en el que se apoyó
 * Migue, con el texto partido para resaltar la frase de respaldo (`match`).
 * Si no se pudo localizar la cita, `match` queda vacío y se muestra el texto sin
 * resaltar (fallback seguro: nunca resaltamos algo que no coincide).
 */
export type AnswerSource = {
  reference: string | null;
  title: string | null;
  before: string;
  match: string;
  after: string;
};

const EMPTY_RETRIEVAL: RagRetrieval = { fragments: [], sources: [], hasEvidence: false };

const DEFAULT_TOP_K = 5;

// Umbral de pertinencia en el espacio de e5-small: las similitudes coseno quedan
// comprimidas (~0.75 fuera de tema, ~0.86+ muy relevante). Un chunk se considera
// pertinente si supera el umbral vectorial O si además matcheó por full-text.
const MIN_VECTOR_SIMILARITY = 0.8;

// Contrato de salida: pedimos JSON con la respuesta y la frase textual de respaldo
// (`cita`) para poder resaltar en la UI exactamente de dónde salió la respuesta.
const OUTPUT_CONTRACT = [
  "",
  "Formato de salida OBLIGATORIO: respondé solo con un objeto JSON válido (sin texto ni markdown fuera del JSON), con esta forma exacta:",
  '{"answer": "<tu respuesta para el usuario, puede incluir markdown>", "cita": "<la frase textual copiada palabra por palabra del fragmento en el que te apoyaste; string vacío si no usaste ningún fragmento>"}'
];

function referenceForChunk(chunk: RagChunk): string | null {
  const meta = chunk.metadata;
  if (meta.articleNumber) return `Art. ${meta.articleNumber}`;
  if (meta.normLabel) return String(meta.normLabel);
  if (meta.hoja) return `Planilla hoja ${meta.hoja}`;
  return null;
}

function toFragment(chunk: RagChunk): RagFragment {
  return {
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceKey,
    sourceTitle: chunk.sourceTitle,
    reference: referenceForChunk(chunk),
    title: (chunk.metadata.title as string | undefined) ?? (chunk.metadata.heading as string | undefined) ?? null,
    content: chunk.content,
    similarity: chunk.vectorSimilarity ?? Math.min(1, chunk.score * RRF_K)
  };
}

/**
 * Retrieval para Migue sobre el motor híbrido local. Sin fragmentos pertinentes,
 * `hasEvidence` es false y el prompt le indica responder "no hay evidencia".
 */
export async function retrieveRelevantFragments(
  question: string,
  options: { mode?: MigueMode; topK?: number } = {}
): Promise<RagRetrieval> {
  const query = question.trim();

  if (!query || !process.env.DATABASE_URL) {
    return EMPTY_RETRIEVAL;
  }

  const topK = options.topK ?? DEFAULT_TOP_K;
  const chunks = await retrieveKnowledge(query, topK, { publicOnly: options.mode !== "internal" });

  const fragments = chunks
    .filter((chunk) => (chunk.vectorSimilarity ?? 0) >= MIN_VECTOR_SIMILARITY || chunk.textMatch)
    .map(toFragment);

  return {
    fragments,
    sources: fragments.map((fragment) => ({
      chunkId: fragment.chunkId,
      title: fragment.title ?? fragment.sourceTitle,
      reference: fragment.reference,
      excerpt: truncateText(fragment.content, 280),
      similarity: fragment.similarity
    })),
    hasEvidence: fragments.length > 0
  };
}

/**
 * Arma el bloque de contexto RAG que se inyecta en el prompt del usuario. Incluye
 * los fragmentos recuperados y las reglas para citarlos sin inventar.
 */
export function buildRagContextBlock(retrieval: RagRetrieval): string {
  if (!retrieval.hasEvidence) {
    return [
      "FUENTE RECUPERADA (RAG): no se encontraron fragmentos suficientemente relevantes en la base documental.",
      "No hay evidencia documental para esta consulta.",
      "- No inventes artículos, ordenanzas, números de expediente ni documentos.",
      "- Indicá claramente: \"No encontré información suficiente en la documentación disponible para responder esa consulta.\"",
      "- Luego sugerí, si podés, qué documento o área sería útil consultar.",
      ...OUTPUT_CONTRACT
    ].join("\n");
  }

  const blocks = retrieval.fragments.map((fragment, index) => {
    const heading = [fragment.reference, fragment.title].filter(Boolean).join(" — ") || fragment.sourceTitle;
    return [
      `[Fragmento ${index + 1}] ${heading}`,
      `Fuente: ${fragment.sourceTitle}${fragment.reference ? ` · ${fragment.reference}` : ""}`,
      `Contenido: ${fragment.content}`
    ].join("\n");
  });

  return [
    "FUENTE RECUPERADA (RAG) — máxima prioridad, es tu principal fuente de verdad:",
    "",
    blocks.join("\n\n"),
    "",
    "Reglas sobre esta fuente recuperada:",
    "- Respondé apoyándote en estos fragmentos por encima de tu conocimiento general.",
    "- Citá única y exactamente los identificadores que aparecen en los fragmentos (por ejemplo, el número de artículo). Nunca inventes un artículo, número o documento que no figure acá.",
    "- Analizá cada fragmento y descartá los que no sean pertinentes a la consulta, aunque hayan sido recuperados.",
    "- Si ninguno responde la consulta, decí que no hay evidencia suficiente en la documentación disponible.",
    "- Si dos fragmentos se contradicen, explicá ambas versiones sin elegir una sin evidencia.",
    ...OUTPUT_CONTRACT
  ].join("\n");
}

/**
 * Construye la fuente única a mostrar: el documento en el que se apoyó la respuesta,
 * con su texto partido para resaltar la cita. Prioriza el fragmento que contiene la
 * cita textual; si no se localiza en ninguno, cae al fragmento más relevante (top-1).
 */
export function buildAnswerSource(retrieval: RagRetrieval, quote: string): AnswerSource | null {
  if (!retrieval.hasEvidence) {
    return null;
  }

  const cleanQuote = quote.trim();
  const matchingFragment = cleanQuote
    ? retrieval.fragments.find((fragment) => locateQuote(fragment.content, cleanQuote).match)
    : undefined;
  const fragment = matchingFragment ?? retrieval.fragments[0];
  const located = locateQuote(fragment.content, cleanQuote);

  return {
    reference: fragment.reference,
    title: fragment.title ?? fragment.sourceTitle,
    before: located.before,
    match: located.match,
    after: located.after
  };
}

/**
 * Ubica una cita dentro del texto del documento y lo parte en before/match/after.
 * Primero intenta coincidencia exacta; si falla, tolera diferencias de espacios en
 * blanco. Si no encuentra nada, devuelve todo el texto en `before` sin resaltar.
 */
function locateQuote(content: string, quote: string): { before: string; match: string; after: string } {
  const cleanQuote = quote.trim();

  if (!cleanQuote) {
    return { before: content, match: "", after: "" };
  }

  const exactIndex = content.indexOf(cleanQuote);
  if (exactIndex >= 0) {
    return {
      before: content.slice(0, exactIndex),
      match: content.slice(exactIndex, exactIndex + cleanQuote.length),
      after: content.slice(exactIndex + cleanQuote.length)
    };
  }

  const flexiblePattern = cleanQuote.split(/\s+/).map(escapeRegExp).join("\\s+");
  const flexible = new RegExp(flexiblePattern, "i").exec(content);
  if (flexible) {
    return {
      before: content.slice(0, flexible.index),
      match: flexible[0],
      after: content.slice(flexible.index + flexible[0].length)
    };
  }

  return { before: content, match: "", after: "" };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateText(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
