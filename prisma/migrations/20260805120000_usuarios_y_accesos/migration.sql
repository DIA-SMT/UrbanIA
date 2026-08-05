-- Módulo Configuración > Usuarios y Accesos (Fase 1).
-- Pensada para ejecutarse a mano en el editor SQL de Supabase (base compartida:
-- nunca `migrate dev`). Si después se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260805120000_usuarios_y_accesos

-- 1. Renombrar valores del enum de roles. RENAME VALUE preserva las filas
--    existentes: los usuarios OFFICIAL pasan a OBSERVER y los TECHNICIAN a
--    CPU_USER sin tocar la tabla "User".
ALTER TYPE "UserRole" RENAME VALUE 'OFFICIAL' TO 'OBSERVER';
ALTER TYPE "UserRole" RENAME VALUE 'TECHNICIAN' TO 'CPU_USER';

-- 2. Enums nuevos.
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'INACTIVE');
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 3. Catálogo de áreas y dependencias.
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");

CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dependency_areaId_name_key" ON "Dependency"("areaId", "name");

ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Columnas nuevas en "User". Todas nullables o con default: las filas
--    existentes no se tocan y quedan ACTIVE.
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "siditucId" TEXT;
ALTER TABLE "User" ADD COLUMN "siditucVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "areaId" TEXT;
ALTER TABLE "User" ADD COLUMN "dependencyId" TEXT;

CREATE UNIQUE INDEX "User_siditucId_key" ON "User"("siditucId");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

ALTER TABLE "User" ADD CONSTRAINT "User_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_dependencyId_fkey"
    FOREIGN KEY ("dependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Bitácora de administración de usuarios (solo inserción, nunca update/delete).
CREATE TABLE "UserAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAuditLog_targetUserId_createdAt_idx" ON "UserAuditLog"("targetUserId", "createdAt");
CREATE INDEX "UserAuditLog_actorId_createdAt_idx" ON "UserAuditLog"("actorId", "createdAt");
CREATE INDEX "UserAuditLog_createdAt_idx" ON "UserAuditLog"("createdAt");

ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Solicitudes de acceso (estructura lista; se puebla al activar SIDITUC).
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "areaId" TEXT,
    "dependencyId" TEXT,
    "siditucStatus" TEXT,
    "requestedRole" "UserRole",
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");

-- 7. Seed mínimo del catálogo para que los filtros no arranquen vacíos.
--    Ids fijos y legibles a propósito: son datos de catálogo, no de usuario.
INSERT INTO "Area" ("id", "name") VALUES
    ('area-planeamiento', 'Planeamiento Urbano'),
    ('area-obras-publicas', 'Obras Públicas'),
    ('area-modernizacion', 'Modernización'),
    ('area-gobierno', 'Gobierno');

INSERT INTO "Dependency" ("id", "name", "areaId") VALUES
    ('dep-cpu', 'Consejo del Plan Urbano (CPU)', 'area-planeamiento'),
    ('dep-dir-planeamiento', 'Dirección de Planeamiento', 'area-planeamiento'),
    ('dep-ciudad-digital', 'Ciudad Digital', 'area-modernizacion');
