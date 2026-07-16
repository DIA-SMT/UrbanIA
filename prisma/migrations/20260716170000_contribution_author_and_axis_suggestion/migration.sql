-- Autor del aporte: sin este vinculo no hay forma de contactar al vecino, porque el
-- email vive en User y el aporte solo guardaba nombre y DNI sueltos.
-- Nullable: los aportes anteriores al login obligatorio no tienen autor.
ALTER TABLE "CitizenContribution" ADD COLUMN "userId" TEXT;

-- SetNull y no Cascade: si el vecino borra su cuenta, el aporte sigue existiendo
-- para el municipio; lo que se pierde es el vinculo, no el reclamo.
ALTER TABLE "CitizenContribution"
  ADD CONSTRAINT "CitizenContribution_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CitizenContribution_userId_idx" ON "CitizenContribution"("userId");

-- Eje sugerido por Migue vs confirmado por una persona. Arranca en false para que
-- los aportes ya cargados (con el eje "Ambiente" que ponia la heuristica vieja)
-- no se muestren como si alguien los hubiera revisado.
ALTER TABLE "CitizenContribution" ADD COLUMN "axisReason" TEXT;
ALTER TABLE "CitizenContribution" ADD COLUMN "axisConfirmed" BOOLEAN NOT NULL DEFAULT false;
