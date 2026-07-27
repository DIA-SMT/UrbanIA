-- La importancia de los temas observados (Ficha 2) vivia solo en las filas de
-- HearingObservedTopic. Si el operador guardaba conclusiones sin temas
-- cargados, no habia donde persistirla y al releer volvia al default "Medio".
-- La ficha tiene un unico selector, asi que la importancia es del acta.
ALTER TABLE "HearingRecord" ADD COLUMN "topicsImportance" "TopicImportance";

-- Backfill: las actas que ya tienen temas conservan la importancia que
-- compartian sus filas.
UPDATE "HearingRecord" hr
SET "topicsImportance" = t."importance"
FROM (
  SELECT DISTINCT ON ("hearingRecordId") "hearingRecordId", "importance"
  FROM "HearingObservedTopic"
  ORDER BY "hearingRecordId", "createdAt" ASC
) t
WHERE hr."id" = t."hearingRecordId";
