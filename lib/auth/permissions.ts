import type { UserRole } from "@prisma/client";

/**
 * RBAC de UrbanIA. Los chequeos del servidor consultan PERMISOS, nunca roles.
 *
 * La matriz rol -> permiso vive en la BASE (tabla RolePermission) y la editan los
 * administradores desde /admin/configuracion/permisos. Este módulo define QUÉ
 * permisos existen; la base define QUIÉN los tiene.
 *
 * Los helpers reciben la SESIÓN, no el rol: `getSessionUser()` resuelve los
 * permisos una sola vez por request y los deja en `session.permissions`, así los
 * chequeos siguen siendo síncronos y no hay una consulta a la base por cada
 * `hasPermission`.
 */

export const PERMISSION_CATALOG = [
  { key: "internal.view", module: "Sistema", label: "Acceder al sistema interno", description: "Ver mapas, proyectos, normas, audiencias y documentos del sistema interno." },
  { key: "projects.create", module: "Proyectos", label: "Crear proyectos", description: "Dar de alta proyectos y propuestas oficiales." },
  { key: "projects.edit", module: "Proyectos", label: "Editar proyectos", description: "Modificar proyectos existentes y su estado." },
  { key: "projects.delete", module: "Proyectos", label: "Eliminar proyectos", description: "Borrar proyectos de la cartera." },
  { key: "hearings.create", module: "Audiencias", label: "Crear audiencias", description: "Convocar y cargar audiencias públicas." },
  { key: "hearings.edit", module: "Audiencias", label: "Editar audiencias", description: "Editar fichas, actas y conclusiones, y grabar la sesión en vivo." },
  { key: "hearings.delete", module: "Audiencias", label: "Eliminar audiencias", description: "Borrar audiencias y su material." },
  { key: "norms.create", module: "Normativa", label: "Crear reformas normativas", description: "Iniciar expedientes de reforma en la Fábrica de Normas." },
  { key: "norms.edit", module: "Normativa", label: "Editar reformas normativas", description: "Editar el estado de una reforma y sus anclajes al código vigente." },
  { key: "norms.delete", module: "Normativa", label: "Eliminar reformas normativas", description: "Borrar un expediente de reforma completo." },
  { key: "documents.upload", module: "Documentos", label: "Subir documentos", description: "Cargar actas, informes y anexos." },
  { key: "documents.delete", module: "Documentos", label: "Eliminar documentos", description: "Quitar documentos cargados." },
  { key: "proposals.manage", module: "Participación", label: "Administrar propuestas", description: "Gestionar aportes y propuestas ciudadanas." },
  { key: "debates.create", module: "Foro", label: "Crear debates", description: "Abrir, cerrar y archivar debates del foro interno." },
  { key: "debates.participate", module: "Foro", label: "Participar en debates", description: "Publicar argumentos con postura y adherir a los de otros." },
  { key: "debates.moderate", module: "Foro", label: "Moderar debates", description: "Ocultar argumentos con motivo; nada se borra." },
  { key: "maps.manage", module: "Mapas", label: "Administrar mapas", description: "Gestionar capas y datos del mapa territorial." },
  { key: "ai.execute", module: "Asistente IA", label: "Ejecutar IA interna", description: "Transcribir, analizar y diagnosticar con el modelo, sobre material no público." },
  { key: "content.publish", module: "Publicación", label: "Publicar contenido", description: "Publicar contenido visible para la ciudadanía." },
  { key: "users.manage", module: "Administración", label: "Administrar usuarios", description: "Vincular cuentas, cambiar roles, suspender y reactivar usuarios." },
  { key: "roles.manage", module: "Administración", label: "Administrar roles y permisos", description: "Definir qué permisos incluye cada rol." },
  { key: "settings.manage", module: "Administración", label: "Administrar configuraciones", description: "Modificar la configuración general del sistema." },
  { key: "audit.view", module: "Administración", label: "Ver auditoría", description: "Consultar la bitácora de cambios y accesos." }
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];

const CATALOG_KEYS = new Set<string>(PERMISSION_CATALOG.map((permission) => permission.key));

/** Descarta claves que ya no están en el catálogo: una fila vieja en la base no rompe nada. */
export function toPermissionSet(keys: readonly string[]): ReadonlySet<Permission> {
  return new Set(keys.filter((key): key is Permission => CATALOG_KEYS.has(key)));
}

/**
 * Cualquier cosa que lleve permisos ya resueltos. En la práctica es SessionUser,
 * pero el tipo es mínimo a propósito: así los helpers no dependen de lib/auth/api
 * y no se arma un ciclo de imports.
 */
export type PermissionHolder = { permissions: ReadonlySet<Permission> };

export function hasPermission(holder: PermissionHolder, permission: Permission): boolean {
  return holder.permissions.has(permission);
}

/** Puede entrar al sistema interno (aunque sea en solo lectura). */
export function canViewInternal(holder: PermissionHolder): boolean {
  return holder.permissions.has("internal.view");
}

/**
 * Matriz inicial, la que siembra prisma/migrations/20260813120000_permisos_por_rol.
 *
 * NO es la fuente de verdad en runtime: sirve para cotejar la migración a ojo y
 * para el script de recuperación. Si un administrador edita la matriz, esta
 * constante queda desactualizada a propósito — la verdad está en la base.
 */
export const SEED_ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: PERMISSION_CATALOG.map((permission) => permission.key),
  CPU_USER: [
    "internal.view",
    "projects.create",
    "projects.edit",
    "hearings.create",
    "hearings.edit",
    "norms.create",
    "norms.edit",
    "documents.upload",
    "documents.delete",
    "proposals.manage",
    "debates.participate",
    "ai.execute",
    "content.publish"
  ],
  OBSERVER: ["internal.view"],
  CITIZEN: []
};
