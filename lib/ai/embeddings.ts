import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { join } from "node:path";

/**
 * Embeddings locales y gratuitos con multilingual-e5-small (384 dimensiones).
 * El modelo (~110 MB) se descarga una vez y queda cacheado en .cache/transformers;
 * las corridas siguientes cargan desde disco y la inferencia es local (CPU).
 *
 * Convención e5: los documentos se embeben con prefijo "passage: " y las
 * consultas con "query: ". Sin esos prefijos la calidad cae.
 */
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
export const EMBEDDING_DIMENSIONS = 384;

env.cacheDir = join(process.cwd(), ".cache", "transformers");

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
  }
  return extractorPromise;
}

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) {
    return [];
  }
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const flat = output.data as Float32Array;
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += 1) {
    vectors.push(Array.from(flat.slice(index * EMBEDDING_DIMENSIONS, (index + 1) * EMBEDDING_DIMENSIONS)));
  }
  return vectors;
}

/** Embebe fragmentos de documentos (prefijo "passage: "). */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts.map((text) => `passage: ${text}`));
}

/** Embebe una consulta de usuario (prefijo "query: "). */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([`query: ${text}`]);
  return vector;
}

/** Serializa un vector al literal que espera pgvector: '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
