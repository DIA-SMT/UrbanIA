-- Corrige el nombre del proveedor municipal de identidad sin perder datos.
ALTER TABLE "User" RENAME COLUMN "siditucId" TO "ciditucId";
ALTER TABLE "User" RENAME COLUMN "siditucVerifiedAt" TO "ciditucVerifiedAt";
ALTER INDEX "User_siditucId_key" RENAME TO "User_ciditucId_key";

ALTER TABLE "AccessRequest" RENAME COLUMN "siditucStatus" TO "ciditucStatus";
