-- Fabrica de Normas: contenedor NormativeReform + reinterpretacion de Project
-- como norma de un codigo nuevo. Cambios aditivos, sin migracion destructiva.

-- CreateEnum
CREATE TYPE "ReformStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CONSOLIDATED', 'ARCHIVED');

-- AlterEnum: nuevas relaciones de anclaje (deroga / reemplaza)
ALTER TYPE "NormativeRelationshipType" ADD VALUE 'REPEALS' AFTER 'MODIFIES';
ALTER TYPE "NormativeRelationshipType" ADD VALUE 'REPLACES' AFTER 'REPEALS';

-- CreateTable
CREATE TABLE "NormativeReform" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReformStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeReform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NormativeReform_code_key" ON "NormativeReform"("code");
CREATE INDEX "NormativeReform_status_idx" ON "NormativeReform"("status");
CREATE INDEX "NormativeReform_createdAt_idx" ON "NormativeReform"("createdAt");

-- AddForeignKey
ALTER TABLE "NormativeReform" ADD CONSTRAINT "NormativeReform_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Project como norma (campos opcionales, no rompe filas existentes)
ALTER TABLE "Project" ADD COLUMN "reformId" TEXT,
ADD COLUMN "articleNumber" TEXT,
ADD COLUMN "articleText" TEXT;

-- CreateIndex
CREATE INDEX "Project_reformId_idx" ON "Project"("reformId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_reformId_fkey" FOREIGN KEY ("reformId") REFERENCES "NormativeReform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: texto de articulo sugerido por la IA
ALTER TABLE "ProjectDiagnosis" ADD COLUMN "proposedText" TEXT;
