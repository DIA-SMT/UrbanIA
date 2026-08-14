-- Marca de "esto no era una consulta" en el registro de Migue.
--
-- Motivo: un mensaje como "bot" quedaba clasificado como pregunta normativa sin
-- respuesta, y contaba como hueco de conocimiento. Con 12 consultas cargadas eso
-- ya ponia la tasa de sin-respuesta en 42%, un numero que no se puede usar para
-- decidir nada. El clasificador de intencion ahora tiene un tercer eje
-- (descartable) y su resultado se persiste acá.
--
-- Campo propio y no inferido de `normative = false`, que mezcla la basura con
-- preguntas legitimas ajenas a la normativa. La separacion tambien importa para el
-- dashboard de super Migue: dos instancias solo son comparables si ambas descartan
-- el ruido con el mismo criterio.
--
-- Las filas descartadas se conservan, no se borran: un pico de mensajes asi es
-- informacion (alguien probando, un patron de abuso, un campo que confunde).
--
-- ADITIVA Y RETROCOMPATIBLE: la columna trae DEFAULT, asi que el codigo anterior
-- sigue insertando sin conocerla. Se puede aplicar ANTES de desplegar sin dejar
-- produccion en un estado intermedio roto, al contrario de
-- 20260814120000_voto_por_cuenta_de_persona, que cambiaba una regla de unicidad.
--
-- Las filas historicas quedan en false: no se puede reclasificar hacia atras sin
-- volver a pasar cada pregunta por el modelo. La consulta "bot" que ya existe va a
-- seguir contando como hueco hasta que salga de la ventana de 30 dias.

ALTER TABLE "AiQuery" ADD COLUMN IF NOT EXISTS "discarded" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AiQuery_discarded_createdAt_idx" ON "AiQuery"("discarded", "createdAt");
