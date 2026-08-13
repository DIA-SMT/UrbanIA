-- Matriz rol -> permiso en base. Deja de vivir hardcodeada en
-- lib/auth/permissions.ts y pasa a ser editable desde /admin/configuracion/permisos.
-- Pensada para ejecutarse a mano en el editor SQL de Supabase (base compartida:
-- nunca `migrate dev`). Si después se usa Prisma Migrate, marcarla aplicada con:
--   npx prisma migrate resolve --applied 20260813120000_permisos_por_rol
--
-- Este archivo es además el script de RECUPERACIÓN: si la tabla queda vacía por
-- accidente, volver a correrlo entero restaura la matriz original, y no toca nada
-- si la matriz ya está cargada (ver el WHERE NOT EXISTS del paso 2).

-- 1. Tabla de concesiones. Una fila = un permiso concedido a un rol; la ausencia
--    de fila es denegación. Sin FK sobre "permission": el catálogo vive tipado en
--    código (PERMISSION_CATALOG), igual que UserAuditLog.action.
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permission_key"
    ON "RolePermission"("role", "permission");

-- 2. Seed: la matriz EXACTA que hoy vive en ROLE_PERMISSIONS. El día del deploy
--    nadie gana ni pierde un permiso. Escrita fila por fila a propósito: tiene que
--    poder cotejarse a ojo contra lib/auth/permissions.ts.
--
--    Ids fijos y legibles ('rp-<rol>-<permiso>'), no cuid, como el seed de
--    "Area"/"Dependency": reejecutar no cambia ningún id.
--
--    WHERE NOT EXISTS: el seed solo corre sobre una matriz VIRGEN. Sin eso, una
--    segunda corrida le devolvería a un rol un permiso que un administrador ya
--    había revocado a mano: ON CONFLICT no ve conflicto porque la fila fue
--    BORRADA, no modificada. Una migración que resucita permisos revocados es un
--    incidente de seguridad silencioso.
--    ON CONFLICT queda como red para dos corridas simultáneas, que verían las dos
--    la tabla vacía.
INSERT INTO "RolePermission" ("id", "role", "permission")
SELECT seed.id, seed.role::"UserRole", seed.permission
FROM (VALUES
    -- ADMIN: todos los permisos del catálogo (23).
    ('rp-admin-internal-view',            'ADMIN', 'internal.view'),
    ('rp-admin-projects-create',          'ADMIN', 'projects.create'),
    ('rp-admin-projects-edit',            'ADMIN', 'projects.edit'),
    ('rp-admin-projects-delete',          'ADMIN', 'projects.delete'),
    ('rp-admin-hearings-create',          'ADMIN', 'hearings.create'),
    ('rp-admin-hearings-edit',            'ADMIN', 'hearings.edit'),
    ('rp-admin-hearings-delete',          'ADMIN', 'hearings.delete'),
    ('rp-admin-norms-create',             'ADMIN', 'norms.create'),
    ('rp-admin-norms-edit',               'ADMIN', 'norms.edit'),
    ('rp-admin-norms-delete',             'ADMIN', 'norms.delete'),
    ('rp-admin-documents-upload',         'ADMIN', 'documents.upload'),
    ('rp-admin-documents-delete',         'ADMIN', 'documents.delete'),
    ('rp-admin-proposals-manage',         'ADMIN', 'proposals.manage'),
    ('rp-admin-debates-create',           'ADMIN', 'debates.create'),
    ('rp-admin-debates-participate',      'ADMIN', 'debates.participate'),
    ('rp-admin-debates-moderate',         'ADMIN', 'debates.moderate'),
    ('rp-admin-maps-manage',              'ADMIN', 'maps.manage'),
    ('rp-admin-ai-execute',               'ADMIN', 'ai.execute'),
    ('rp-admin-content-publish',          'ADMIN', 'content.publish'),
    ('rp-admin-users-manage',             'ADMIN', 'users.manage'),
    ('rp-admin-roles-manage',             'ADMIN', 'roles.manage'),
    ('rp-admin-settings-manage',          'ADMIN', 'settings.manage'),
    ('rp-admin-audit-view',               'ADMIN', 'audit.view'),

    -- CPU_USER (Usuario normal): crea y edita contenido, no borra proyectos,
    -- audiencias ni normas, no administra personas ni configuración (13).
    ('rp-cpu-user-internal-view',         'CPU_USER', 'internal.view'),
    ('rp-cpu-user-projects-create',       'CPU_USER', 'projects.create'),
    ('rp-cpu-user-projects-edit',         'CPU_USER', 'projects.edit'),
    ('rp-cpu-user-hearings-create',       'CPU_USER', 'hearings.create'),
    ('rp-cpu-user-hearings-edit',         'CPU_USER', 'hearings.edit'),
    ('rp-cpu-user-norms-create',          'CPU_USER', 'norms.create'),
    ('rp-cpu-user-norms-edit',            'CPU_USER', 'norms.edit'),
    ('rp-cpu-user-documents-upload',      'CPU_USER', 'documents.upload'),
    ('rp-cpu-user-documents-delete',      'CPU_USER', 'documents.delete'),
    ('rp-cpu-user-proposals-manage',      'CPU_USER', 'proposals.manage'),
    ('rp-cpu-user-debates-participate',   'CPU_USER', 'debates.participate'),
    ('rp-cpu-user-ai-execute',            'CPU_USER', 'ai.execute'),
    ('rp-cpu-user-content-publish',       'CPU_USER', 'content.publish'),

    -- OBSERVER (Consulta): entra al sistema interno en solo lectura (1).
    ('rp-observer-internal-view',         'OBSERVER', 'internal.view')

    -- CITIZEN: ningún permiso. Cero permisos se modela con CERO FILAS, no con
    -- filas negadas. No hay nada que insertar y no es un olvido.
) AS seed("id", "role", "permission")
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT ("role", "permission") DO NOTHING;

-- El cast va en el SELECT y no adentro del VALUES a propósito: casteando solo la
-- primera fila, Postgres resolvería el tipo de la columna por inferencia y bastaría
-- que alguien reordenara las filas para que el script cambiara de comportamiento.
--
-- Verificación posterior (correr aparte). Tiene que dar 23 / 13 / 1, sin CITIZEN:
--   SELECT "role", count(*) FROM "RolePermission" GROUP BY "role" ORDER BY 1;
