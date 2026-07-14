-- Índice vectorial para la búsqueda semántica del RAG de Migue.
-- HNSW con distancia coseno: los vectores de text-embedding-3 vienen normalizados,
-- así que coseno es la métrica adecuada. HNSW no requiere entrenamiento previo ni
-- fijar "lists" según el número de filas (a diferencia de ivfflat), por lo que rinde
-- bien incluso con pocos artículos y escala sin re-tuning.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);
