-- Embeddings locales multilingual-e5-small: la columna pasa de vector(1536) a vector(384).
-- Los embeddings existentes (1536, de un pipeline previo) quedan obsoletos y se descartan;
-- la ingesta re-embebe todo con el modelo local.
DROP INDEX IF EXISTS "KnowledgeChunk_embedding_hnsw_idx";

UPDATE "KnowledgeChunk" SET "embedding" = NULL;

ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(384) USING NULL;

-- Índice HNSW por coseno para búsqueda semántica.
CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
