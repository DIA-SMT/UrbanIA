import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { embedText, hasEmbeddingConfig, toVectorLiteral } from "@/lib/ai/embeddings";
import type { MigueMode } from "@/lib/ai/migue";

/**
 * Retrieval semántico para el RAG de Migue.
 *
 * Embebe la consulta del usuario, busca los KnowledgeChunk más cercanos por
 * distancia coseno (índice HNSW) y devuelve solo los que superan un umbral de
 * relevancia. Es lo que evita que Migue alucine: sin fragmentos pertinentes,
 * `hasEvidence` es false y el prompt le indica responder "no hay evidencia".
 */

const DEFAULT_TOP_K = 5;

// Distancia coseno máxima (operador <=> de pgvector) para considerar pertinente
// un fragmento. Referencia empírica sobre el Código: ~0.39 = muy relevante,
// ~0.65 = límite, >0.7 = casi siempre fuera de tema. Ajustable si hiciera falta.
const MAX_COSINE_DISTANCE = 0.65;

// En modo público solo se recupera de fuentes públicas. Actas, reportes internos,
// archivos y notas quedan reservados a personal municipal. El filtro va en la
// query (no solo en el prompt) para que la info interna nunca llegue al modelo.
const PUBLIC_SOURCE_KINDS = ["REGULATION", "WEB_PAGE"];

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
 * Fuente única que se muestra en la UI: el artículo principal en el que se apoyó
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

type ChunkQueryRow = {
  chunkId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  sourceId: string;
  sourceTitle: string;
  distance: number;
};

const EMPTY_RETRIEVAL: RagRetrieval = { fragments: [], sources: [], hasEvidence: false };

// Contrato de salida: pedimos JSON con la respuesta y la frase textual de respaldo
// (`cita`) para poder resaltar en la UI exactamente de dónde salió la respuesta.
const OUTPUT_CONTRACT = [
  "",
  "Formato de salida OBLIGATORIO: respondé solo con un objeto JSON válido (sin texto ni markdown fuera del JSON), con esta forma exacta:",
  '{"answer": "<tu respuesta para el usuario, puede incluir markdown>", "cita": "<la frase textual copiada palabra por palabra del fragmento en el que te apoyaste; string vacío si no usaste ningún fragmento>"}'
];

export async function retrieveRelevantFragments(
  question: string,
  options: { mode?: MigueMode; topK?: number } = {}
): Promise<RagRetrieval> {
  const query = question.trim();

  if (!query || !hasEmbeddingConfig() || !process.env.DATABASE_URL) {
    return EMPTY_RETRIEVAL;
  }

  const topK = options.topK ?? DEFAULT_TOP_K;
  const vector = toVectorLiteral(await embedText(query));

  const visibilityFilter =
    options.mode === "internal"
      ? Prisma.empty
      : Prisma.sql`AND s."kind"::text IN (${Prisma.join(PUBLIC_SOURCE_KINDS)})`;

  const rows = await prisma.$queryRaw<ChunkQueryRow[]>(Prisma.sql`
    SELECT
      c."id" AS "chunkId",
      c."content" AS "content",
      c."metadata" AS "metadata",
      s."id" AS "sourceId",
      s."title" AS "sourceTitle",
      (c."embedding" <=> ${vector}::vector) AS "distance"
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
    WHERE c."embedding" IS NOT NULL
    ${visibilityFilter}
    ORDER BY c."embedding" <=> ${vector}::vector
    LIMIT ${topK}
  `);

  const fragments = rows
    .filter((row) => Number(row.distance) <= MAX_COSINE_DISTANCE)
    .map(toFragment);

  return {
    fragments,
    sources: fragments.map((fragment) => ({
      chunkId: fragment.chunkId,
      title: fragment.title ?? fragment.sourceTitle,
      reference: fragment.reference,
      excerpt: truncate(fragment.content, 280),
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
 * Construye la fuente única a mostrar: el artículo en el que se apoyó la respuesta,
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
 * Ubica una cita dentro del texto del artículo y lo parte en before/match/after.
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

function toFragment(row: ChunkQueryRow): RagFragment {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const articleNumber = typeof metadata.articleNumber === "string" ? metadata.articleNumber : null;
  const title = typeof metadata.title === "string" ? metadata.title : null;
  const distance = Number(row.distance);

  return {
    chunkId: row.chunkId,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    reference: articleNumber ? `Art. ${articleNumber}` : null,
    title,
    content: row.content,
    similarity: Math.max(0, 1 - distance)
  };
}

function truncate(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
