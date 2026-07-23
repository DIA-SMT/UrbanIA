-- Unificacion del modulo de audiencias: HearingRecord pasa a ser el unico
-- almacenamiento de la ficha (foto 1) y las conclusiones (foto 2), absorbiendo
-- los campos que hasta ahora vivian en Meeting.metadata. Solo columnas nuevas,
-- todas opcionales: no toca datos existentes.

-- Ficha: etiqueta exacta del origen + participacion declarada por el operador.
ALTER TABLE "HearingRecord" ADD COLUMN "proposalSource" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "participantsText" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "institution" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "participantRole" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "actorType" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "intervention" TEXT;

-- Conclusiones: observaciones del acta como conjunto (las por-tema ya existen
-- en HearingObservedTopic).
ALTER TABLE "HearingRecord" ADD COLUMN "technicalObservation" TEXT;
ALTER TABLE "HearingRecord" ADD COLUMN "citizenObservation" TEXT;

-- Documentos: el archivo real vive en Supabase Storage; estas columnas
-- permiten borrarlo del bucket y mostrar el peso.
ALTER TABLE "HearingDocument" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "HearingDocument" ADD COLUMN "sizeBytes" INTEGER;
