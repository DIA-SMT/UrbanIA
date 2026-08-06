-- Foro Fase 2: audiencia de origen obligatoria + análisis de Migue al cierre.
-- Ejecutar a mano en el editor SQL de Supabase (base compartida: nunca `migrate dev`).
-- Si después se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260806160000_foro_audiencia_y_analisis

-- Audiencia de origen del debate. Nullable en base por los debates ya creados;
-- la API la exige en toda alta nueva.
ALTER TABLE "Debate" ADD COLUMN "meetingId" TEXT;

-- Análisis de Migue: informe JSON, cuándo se generó, sobre cuántos argumentos
-- y con qué modelo.
ALTER TABLE "Debate" ADD COLUMN "analysis" JSONB;
ALTER TABLE "Debate" ADD COLUMN "analysisAt" TIMESTAMP(3);
ALTER TABLE "Debate" ADD COLUMN "analysisArgumentCount" INTEGER;
ALTER TABLE "Debate" ADD COLUMN "analysisModel" TEXT;

ALTER TABLE "Debate" ADD CONSTRAINT "Debate_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
