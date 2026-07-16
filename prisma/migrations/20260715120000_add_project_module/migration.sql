-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('FORMULATION', 'TECHNICAL_REVIEW', 'CABINET_REVIEW', 'TENDER', 'EXECUTION', 'CLOSED');

-- CreateEnum
CREATE TYPE "MunicipalArea" AS ENUM ('PLANEAMIENTO', 'OBRAS_PUBLICAS', 'AMBIENTE', 'MOVILIDAD', 'ESPACIO_PUBLICO', 'DESARROLLO_SOCIAL', 'HACIENDA', 'LEGAL', 'OTRA');

-- CreateEnum
CREATE TYPE "FeasibilityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BudgetCostType" AS ENUM ('OBRA', 'ESTUDIO_PROYECTO', 'EQUIPAMIENTO', 'MANTENIMIENTO', 'EXPROPIACION', 'OTRO');

-- AlterTable
ALTER TABLE "CabinetIdea" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "stage" "ProjectStage" NOT NULL DEFAULT 'FORMULATION',
    "source" "ProposalSource" NOT NULL DEFAULT 'TECHNICAL_TEAM',
    "areas" "MunicipalArea"[],
    "requiresEIA" BOOLEAN NOT NULL DEFAULT false,
    "eiaNotes" TEXT,
    "proposalId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "addressLabel" TEXT,
    "districtId" TEXT,
    "officialNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDiagnosis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "feasibility" "FeasibilityLevel" NOT NULL,
    "scope" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "citedArticles" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "editedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "costType" "BudgetCostType" NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fundingSource" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "excerpt" TEXT,
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_proposalId_idx" ON "Project"("proposalId");

-- CreateIndex
CREATE INDEX "ProjectDiagnosis_projectId_createdAt_idx" ON "ProjectDiagnosis"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDiagnosis_projectId_version_key" ON "ProjectDiagnosis"("projectId", "version");

-- CreateIndex
CREATE INDEX "ProjectBudgetItem_projectId_idx" ON "ProjectBudgetItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

-- CreateIndex
CREATE INDEX "CabinetIdea_projectId_idx" ON "CabinetIdea"("projectId");

-- AddForeignKey
ALTER TABLE "CabinetIdea" ADD CONSTRAINT "CabinetIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiagnosis" ADD CONSTRAINT "ProjectDiagnosis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetItem" ADD CONSTRAINT "ProjectBudgetItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

