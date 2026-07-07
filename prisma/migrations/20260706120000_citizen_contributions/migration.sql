CREATE TYPE "CitizenContributionKind" AS ENUM ('PROPOSAL', 'CLAIM', 'CONTRIBUTION');

CREATE TYPE "CitizenContributionStatus" AS ENUM ('NEW', 'LINKED_TO_PROPOSAL', 'UNDER_REVIEW', 'RESOLVED', 'ARCHIVED');

CREATE TABLE "CitizenContribution" (
    "id" TEXT NOT NULL,
    "kind" "CitizenContributionKind" NOT NULL,
    "name" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fileName" TEXT,
    "axis" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" "CitizenContributionStatus" NOT NULL DEFAULT 'NEW',
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CitizenContribution_createdAt_idx" ON "CitizenContribution"("createdAt");
CREATE INDEX "CitizenContribution_kind_idx" ON "CitizenContribution"("kind");
CREATE INDEX "CitizenContribution_status_idx" ON "CitizenContribution"("status");
CREATE INDEX "CitizenContribution_proposalId_idx" ON "CitizenContribution"("proposalId");

ALTER TABLE "CitizenContribution" ADD CONSTRAINT "CitizenContribution_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
