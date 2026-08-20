-- Por que la respuesta de Migue cito o no cito una fuente.
--
-- Hasta ahora "no cito" y "no supo" eran la misma senal. El prompt le ordena a
-- Migue dejar la cita VACIA cuando solo descarta ("el Codigo no regula esto"), y
-- la metrica leia esa cita vacia como hueco de conocimiento: una respuesta
-- correcta figuraba como fracaso, y el panel invitaba a "cargar" algo que no
-- faltaba. Verificado el 2026-08-19 sobre 11 consultas reales: 10 marcadas sin
-- respaldo, ninguna era un hueco de verdad.
--
-- Solo NOT_FOUND es un hueco. Las filas viejas quedan en NULL: no se puede
-- inferir el motivo hacia atras sin volver a preguntarle al modelo, y adivinarlo
-- ensuciaria la unica metrica que sirve para decidir que cargar.
--
-- Pensada para ejecutarse a mano en el editor SQL de Supabase (base compartida:
-- nunca `migrate dev`). Si despues se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260819180000_motivo_de_la_cita_vacia

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnswerBasis') THEN
        CREATE TYPE "AnswerBasis" AS ENUM ('CITED', 'OUT_OF_SCOPE', 'MISSING_INPUT', 'NOT_FOUND');
    END IF;
END
$$;

ALTER TABLE "AiQuery" ADD COLUMN IF NOT EXISTS "answerBasis" "AnswerBasis";

-- Verificacion posterior (correr aparte). Al aplicar tiene que dar todo en NULL;
-- despues del deploy, las consultas nuevas del chat empiezan a traer motivo:
--   SELECT "answerBasis", count(*) FROM "AiQuery" GROUP BY 1 ORDER BY 2 DESC;
