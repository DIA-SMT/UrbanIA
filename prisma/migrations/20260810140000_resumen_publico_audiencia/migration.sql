-- Resumen ejecutivo publicado de una audiencia.
-- El PDF se genera con IA y lo aprueba una persona; el portal ciudadano solo
-- muestra el archivo ya publicado, nunca dispara una generacion.
--
-- Ejecutar a mano en el editor SQL de Supabase (base compartida).
-- Con Prisma Migrate: npx prisma migrate resolve --applied 20260810140000_resumen_publico_audiencia

ALTER TABLE "Meeting" ADD COLUMN "publicSummaryUrl" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "publicSummaryPath" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "publicSummaryAt" TIMESTAMP(3);
