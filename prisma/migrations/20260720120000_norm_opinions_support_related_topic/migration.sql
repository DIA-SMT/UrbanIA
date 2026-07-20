-- Devoluciones y apoyo internos sobre una norma, mas el puente entre un aporte
-- fuera del alcance del CPU y el tema del Codigo que si lo roza.
-- Todo aditivo: tablas nuevas y una columna nullable. Ninguna fila existente cambia.

-- Puente hacia el tema relacionado. Nullable porque solo aplica a los aportes
-- "Fuera del alcance del CPU" que ademas rozan un tema (basura -> Usos del suelo,
-- Art. 20). Los aportes ya cargados quedan en null: nadie declaro esa relacion.
ALTER TABLE "CitizenContribution" ADD COLUMN "relatedTopic" TEXT;

-- El ranking de temas agrupa por axis y por relatedTopic: sin estos indices cada
-- carga del panel es un seq scan sobre toda la tabla de aportes.
CREATE INDEX "CitizenContribution_axis_idx" ON "CitizenContribution"("axis");
CREATE INDEX "CitizenContribution_relatedTopic_idx" ON "CitizenContribution"("relatedTopic");

-- CreateTable: devolucion del equipo sobre una norma.
-- No se reutiliza Comment porque cuelga de Proposal (participacion ciudadana).
CREATE TABLE "NormOpinion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NormOpinion_projectId_createdAt_idx" ON "NormOpinion"("projectId", "createdAt");
CREATE INDEX "NormOpinion_userId_idx" ON "NormOpinion"("userId");

-- AddForeignKey
-- Cascade sobre la norma: borrada la norma, sus devoluciones no significan nada.
ALTER TABLE "NormOpinion" ADD CONSTRAINT "NormOpinion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull sobre el autor: si se borra la cuenta la devolucion sobrevive, y sigue
-- identificada por el snapshot en authorName. Por eso authorName es NOT NULL y no
-- se resuelve por join: el nombre tiene que sobrevivir al User.
ALTER TABLE "NormOpinion" ADD CONSTRAINT "NormOpinion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: apoyo (+1) u objecion (-1) del equipo a una norma.
CREATE TABLE "NormSupport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormSupport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- El unique es la regla de negocio: un voto por persona y norma. Cambiar de
-- opinion actualiza el registro (upsert), no acumula votos.
CREATE UNIQUE INDEX "NormSupport_projectId_userId_key" ON "NormSupport"("projectId", "userId");
CREATE INDEX "NormSupport_projectId_idx" ON "NormSupport"("projectId");

-- AddForeignKey
-- Cascade en ambos lados: un voto sin norma o sin votante no es un dato, es basura.
ALTER TABLE "NormSupport" ADD CONSTRAINT "NormSupport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NormSupport" ADD CONSTRAINT "NormSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
