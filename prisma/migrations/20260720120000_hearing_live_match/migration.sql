-- Audiencia en vivo: vinculo audiencia <-> mininorma de la Fabrica de Normas,
-- con postura y fragmento de la transcripcion. Cambios aditivos.

-- CreateEnum
CREATE TYPE "HearingMatchStance" AS ENUM ('SUPPORT', 'OPPOSE', 'CHANGE_REQUEST', 'MENTION');

-- AlterTable: la audiencia debate un codigo nuevo
ALTER TABLE "Meeting" ADD COLUMN "reformId" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_reformId_idx" ON "Meeting"("reformId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_reformId_fkey" FOREIGN KEY ("reformId") REFERENCES "NormativeReform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HearingNormMatch" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fragment" TEXT NOT NULL,
    "stance" "HearingMatchStance" NOT NULL DEFAULT 'MENTION',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingNormMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HearingNormMatch_meetingId_idx" ON "HearingNormMatch"("meetingId");
CREATE INDEX "HearingNormMatch_projectId_idx" ON "HearingNormMatch"("projectId");

-- AddForeignKey
ALTER TABLE "HearingNormMatch" ADD CONSTRAINT "HearingNormMatch_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HearingNormMatch" ADD CONSTRAINT "HearingNormMatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
