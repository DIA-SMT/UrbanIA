-- AiQuery pasa de tabla muerta a registro de consultas de Migue.
-- answered=false marca los huecos de conocimiento (consulta normativa sin
-- evidencia del RAG), la materia prima del futuro panel "que pregunta la gente".
ALTER TABLE "AiQuery" ADD COLUMN "answered" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AiQuery" ADD COLUMN "normative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiQuery" ADD COLUMN "mode" TEXT;
ALTER TABLE "AiQuery" ADD COLUMN "module" TEXT;

CREATE INDEX "AiQuery_answered_createdAt_idx" ON "AiQuery"("answered", "createdAt");
