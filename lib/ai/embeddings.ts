import OpenAI from "openai";

/**
 * Embeddings para el pipeline RAG de Migue.
 *
 * Se generan vía OpenRouter (endpoint OpenAI-compatible) reutilizando la misma
 * OPENROUTER_API_KEY del chat. El modelo por defecto es text-embedding-3-small,
 * que emite 1536 dimensiones y coincide con la columna KnowledgeChunk.embedding.
 */

export const EMBEDDING_DIMENSIONS = 1536;

const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

// OpenRouter acepta lotes grandes, pero mantenemos un tope prudente por request.
const MAX_BATCH_SIZE = 96;

// IMPORTANTE: OpenRouter enruta el mismo nombre de modelo a distintos proveedores y
// a veces devuelve vectores de otra dimensión (p. ej. 384), lo que rompe la búsqueda
// contra la columna vector(1536). Fijamos el proveedor a OpenAI y desactivamos los
// fallbacks para garantizar siempre text-embedding-3-small con 1536 dimensiones.
const PROVIDER_ROUTING = { order: ["OpenAI"], allow_fallbacks: false };

function embeddingParams(input: string | string[]) {
  // El SDK de OpenAI no tipa `provider`, pero OpenRouter lo lee del body.
  return { model: getEmbeddingModel(), input, provider: PROVIDER_ROUTING } as unknown as {
    model: string;
    input: string | string[];
  };
}

export function hasEmbeddingConfig() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getEmbeddingModel() {
  return process.env.OPENROUTER_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UrbanIA"
    }
  });
}

function assertDimensions(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `El modelo de embeddings devolvió ${embedding.length} dimensiones y se esperaban ${EMBEDDING_DIMENSIONS}. ` +
        `Revisá OPENROUTER_EMBEDDING_MODEL (${getEmbeddingModel()}).`
    );
  }

  return embedding;
}

/**
 * Embebe un único texto. Usar para la consulta del usuario en el retrieval.
 */
export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error("No se puede generar un embedding de un texto vacío");
  }

  const client = getClient();
  const response = await client.embeddings.create(embeddingParams(input));
  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error("El servicio de embeddings no devolvió ningún vector");
  }

  return assertDimensions(embedding as number[]);
}

/**
 * Embebe una lista de textos respetando el tope de lote. Devuelve los vectores
 * en el mismo orden de entrada. Usar para indexar los KnowledgeChunk.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const inputs = texts.map((text) => text.trim());

  if (inputs.some((text) => !text)) {
    throw new Error("La lista de textos a embeber contiene entradas vacías");
  }

  const client = getClient();
  const vectors: number[][] = [];

  for (let start = 0; start < inputs.length; start += MAX_BATCH_SIZE) {
    const batch = inputs.slice(start, start + MAX_BATCH_SIZE);
    const response = await client.embeddings.create(embeddingParams(batch));

    // OpenRouter/OpenAI pueden no garantizar el orden: reordenamos por index.
    const ordered = [...response.data].sort((a, b) => a.index - b.index);

    if (ordered.length !== batch.length) {
      throw new Error(`Se enviaron ${batch.length} textos y volvieron ${ordered.length} vectores`);
    }

    ordered.forEach((item) => vectors.push(assertDimensions(item.embedding as number[])));
  }

  return vectors;
}

/**
 * Serializa un vector al literal que pgvector espera: "[0.1,0.2,...]".
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
