-- Registro de audiencias: estado y origen de cada ficha. Cambios aditivos.
-- HearingNormMatch / HearingMatchStance / Meeting.reformId ya existen desde la
-- migracion 20260720120000_hearing_live_match; aca solo se agrega lo nuevo.

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HearingSource" AS ENUM ('LIVE', 'YOUTUBE', 'UPLOAD', 'MANUAL');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "hearingStatus" "HearingStatus",
ADD COLUMN "hearingSource" "HearingSource",
ADD COLUMN "modality" TEXT;
