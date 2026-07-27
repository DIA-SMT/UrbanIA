-- Importador de PDFs a la Fabrica de Normas.
--
-- Dos cambios, ambos aditivos: ninguna columna nueva es NOT NULL sin default,
-- asi que las filas existentes de ProjectAttachment siguen validas tal cual.

-- 1. ProjectAttachment pasa a poder guardar el archivo real, no solo un excerpt.
ALTER TABLE "ProjectAttachment" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "ProjectAttachment" ADD COLUMN "url" TEXT;
ALTER TABLE "ProjectAttachment" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "ProjectAttachment" ADD COLUMN "sizeBytes" INTEGER;
ALTER TABLE "ProjectAttachment" ADD COLUMN "sourcePages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "ProjectAttachment" ADD COLUMN "uploadedBy" TEXT;

-- El borrado de una norma consulta por storagePath para saber si el objeto del
-- bucket lo comparte otro adjunto: sin indice es un scan por cada borrado.
CREATE INDEX "ProjectAttachment_storagePath_idx" ON "ProjectAttachment"("storagePath");

-- 2. Documentos aportados a la reforma. Espeja HearingDocument.
CREATE TABLE "ReformDocument" (
    "id" TEXT NOT NULL,
    "reformId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "sizeBytes" INTEGER,
    "pageCount" INTEGER,
    "summary" TEXT,
    "documentKind" TEXT,
    "sha256" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReformDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReformDocument_reformId_idx" ON "ReformDocument"("reformId");
-- Para detectar que el mismo PDF ya se subio antes de volver a procesarlo.
CREATE INDEX "ReformDocument_sha256_idx" ON "ReformDocument"("sha256");

ALTER TABLE "ReformDocument"
    ADD CONSTRAINT "ReformDocument_reformId_fkey"
    FOREIGN KEY ("reformId") REFERENCES "NormativeReform"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
