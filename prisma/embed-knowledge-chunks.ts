import { PrismaClient, Prisma } from "@prisma/client";
import { embedBatch, getEmbeddingModel, hasEmbeddingConfig, toVectorLiteral } from "../lib/ai/embeddings";

/**
 * Indexación de embeddings para el RAG de Migue.
 *
 * Recorre los KnowledgeChunk (por defecto solo los que aún no tienen vector),
 * los embebe en lotes vía OpenRouter y guarda el resultado en la columna
 * pgvector `embedding`. Es idempotente: correrlo de nuevo solo procesa lo que
 * falta. Con `--all` reindexa todos los chunks (útil si se cambia de modelo).
 *
 *   npm run db:embed:knowledge          # solo los pendientes
 *   npm run db:embed:knowledge -- --all # reindexa todo
 */

const prisma = new PrismaClient({
  datasources: { db: { url: withSingleConnection(process.env.DATABASE_URL || "") } }
});

const BATCH_SIZE = 96;

type ChunkRow = { id: string; content: string };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el entorno");
  if (!hasEmbeddingConfig()) throw new Error("Falta OPENROUTER_API_KEY para generar embeddings");

  const reembedAll = process.argv.includes("--all");

  const rows = reembedAll
    ? await prisma.$queryRaw<ChunkRow[]>`
        SELECT "id", "content" FROM "KnowledgeChunk"
        ORDER BY "sourceId", "chunkIndex"`
    : await prisma.$queryRaw<ChunkRow[]>`
        SELECT "id", "content" FROM "KnowledgeChunk"
        WHERE "embedding" IS NULL
        ORDER BY "sourceId", "chunkIndex"`;

  if (!rows.length) {
    console.log(reembedAll ? "No hay chunks para indexar." : "No hay chunks pendientes: todo está indexado.");
    return;
  }

  console.log(
    `Indexando ${rows.length} chunk(s) con ${getEmbeddingModel()} ` +
      `(modo: ${reembedAll ? "reindexar todo" : "solo pendientes"})...`
  );

  let processed = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const vectors = await embedBatch(batch.map((row) => row.content));

    await prisma.$transaction(
      batch.map((row, offset) =>
        prisma.$executeRaw(
          Prisma.sql`UPDATE "KnowledgeChunk" SET "embedding" = ${toVectorLiteral(vectors[offset])}::vector WHERE "id" = ${row.id}`
        )
      )
    );

    processed += batch.length;
    console.log(`  ${processed}/${rows.length}`);
  }

  console.log(`Listo. ${processed} chunk(s) indexado(s).`);
}

function withSingleConnection(value: string) {
  if (!value) return value;
  const url = new URL(value);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "30");
  return url.toString();
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
