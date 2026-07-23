-- Audiencias publicas sobre el modelo Meeting existente.
--
-- Escrita a mano y no con `prisma migrate diff`: el SQL autogenerado arrastraba
-- drift previo entre el schema y la base (DROP TABLE "NormativeReform", DROP de
-- columnas de "Project" y de los indices vectorial y geoespacial creados a mano).
-- Nada de eso pertenece a este cambio. Esta migracion es estrictamente aditiva:
-- no contiene un solo DROP.

-- CreateEnum
CREATE TYPE "HearingLifecycle" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'REPROGRAMADA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "HearingModality" AS ENUM ('PRESENCIAL', 'VIRTUAL', 'MIXTA');

-- CreateEnum
CREATE TYPE "HearingProposalOrigin" AS ENUM ('CONCEJO', 'CIUDADANIA', 'CODIGO_URBANO');

-- CreateEnum
CREATE TYPE "TopicImportance" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- AlterTable: datos del participante que la audiencia necesita y Meeting no tenia.
-- Todas nullable salvo attended, que lleva default: no rompe las filas existentes.
ALTER TABLE "MeetingParticipant" ADD COLUMN     "actorType" TEXT,
ADD COLUMN     "attended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "intervention" TEXT;

-- CreateTable
CREATE TABLE "HearingRecord" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "lifecycle" "HearingLifecycle" NOT NULL DEFAULT 'PROGRAMADA',
    "modality" "HearingModality" NOT NULL DEFAULT 'PRESENCIAL',
    "mainTopic" TEXT NOT NULL,
    "secondaryTopics" TEXT[],
    "recordNumber" TEXT NOT NULL,
    "recordTitle" TEXT NOT NULL,
    "relatedProposal" TEXT,
    "proposalOrigin" "HearingProposalOrigin" NOT NULL DEFAULT 'CONCEJO',
    "promotingArea" TEXT,
    "recordStatus" TEXT,
    "recordDocument" TEXT,
    "relatedArticles" TEXT[],
    "projectId" TEXT,
    "conclusionsSummary" TEXT,
    "agreements" TEXT,
    "disagreements" TEXT,
    "nextSteps" TEXT,
    "technicalRecommendations" TEXT,
    "decisions" TEXT,
    "proposalStatusAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HearingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HearingObservedTopic" (
    "id" TEXT NOT NULL,
    "hearingRecordId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "importance" "TopicImportance" NOT NULL DEFAULT 'MEDIO',
    "relatedArticle" TEXT,
    "relatedProposal" TEXT,
    "technicalObservation" TEXT,
    "citizenObservation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingObservedTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HearingDocument" (
    "id" TEXT NOT NULL,
    "hearingRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HearingDebateMessage" (
    "id" TEXT NOT NULL,
    "hearingRecordId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingDebateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HearingContribution" (
    "id" TEXT NOT NULL,
    "hearingRecordId" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileNames" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HearingRecord_meetingId_key" ON "HearingRecord"("meetingId");

-- CreateIndex
CREATE INDEX "HearingRecord_lifecycle_idx" ON "HearingRecord"("lifecycle");

-- CreateIndex
CREATE INDEX "HearingRecord_projectId_idx" ON "HearingRecord"("projectId");

-- CreateIndex
CREATE INDEX "HearingObservedTopic_hearingRecordId_idx" ON "HearingObservedTopic"("hearingRecordId");

-- CreateIndex
CREATE INDEX "HearingDocument_hearingRecordId_idx" ON "HearingDocument"("hearingRecordId");

-- CreateIndex
CREATE INDEX "HearingDebateMessage_hearingRecordId_createdAt_idx" ON "HearingDebateMessage"("hearingRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "HearingContribution_hearingRecordId_createdAt_idx" ON "HearingContribution"("hearingRecordId", "createdAt");

-- AddForeignKey
ALTER TABLE "HearingRecord" ADD CONSTRAINT "HearingRecord_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HearingRecord" ADD CONSTRAINT "HearingRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HearingObservedTopic" ADD CONSTRAINT "HearingObservedTopic_hearingRecordId_fkey" FOREIGN KEY ("hearingRecordId") REFERENCES "HearingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HearingDocument" ADD CONSTRAINT "HearingDocument_hearingRecordId_fkey" FOREIGN KEY ("hearingRecordId") REFERENCES "HearingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HearingDebateMessage" ADD CONSTRAINT "HearingDebateMessage_hearingRecordId_fkey" FOREIGN KEY ("hearingRecordId") REFERENCES "HearingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HearingContribution" ADD CONSTRAINT "HearingContribution_hearingRecordId_fkey" FOREIGN KEY ("hearingRecordId") REFERENCES "HearingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
