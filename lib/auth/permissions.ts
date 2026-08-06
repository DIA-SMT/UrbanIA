import type { UserRole } from "@prisma/client";

/**
 * RBAC de UrbanIA. Los chequeos del servidor consultan PERMISOS, nunca roles:
 * un rol es solo un conjunto de permisos. En Fase 1 el mapa vive en código;
 * cuando pase a base (roles/permisos editables) ningún call-site cambia,
 * solo la implementación de `permissionsForRole`.
 */

export const PERMISSION_CATALOG = [
  { key: "internal.view", module: "Sistema", label: "Acceder al sistema interno", description: "Ver mapas, proyectos, normas, audiencias y documentos del sistema interno." },
  { key: "projects.create", module: "Proyectos", label: "Crear proyectos", description: "Dar de alta proyectos y propuestas oficiales." },
  { key: "projects.edit", module: "Proyectos", label: "Editar proyectos", description: "Modificar proyectos existentes y su estado." },
  { key: "projects.delete", module: "Proyectos", label: "Eliminar proyectos", description: "Borrar proyectos de la cartera." },
  { key: "hearings.create", module: "Audiencias", label: "Crear audiencias", description: "Convocar y cargar audiencias públicas." },
  { key: "hearings.edit", module: "Audiencias", label: "Editar audiencias", description: "Editar fichas, actas y conclusiones." },
  { key: "hearings.delete", module: "Audiencias", label: "Eliminar audiencias", description: "Borrar audiencias y su material." },
  { key: "norms.create", module: "Normativa", label: "Crear reformas normativas", description: "Iniciar expedientes de reforma en la Fábrica de Normas." },
  { key: "norms.edit", module: "Normativa", label: "Editar reformas normativas", description: "Editar artículos, vínculos y estados de una reforma." },
  { key: "documents.upload", module: "Documentos", label: "Subir documentos", description: "Cargar actas, informes y anexos." },
  { key: "documents.delete", module: "Documentos", label: "Eliminar documentos", description: "Quitar documentos cargados." },
  { key: "proposals.manage", module: "Participación", label: "Administrar propuestas", description: "Gestionar aportes y propuestas ciudadanas." },
  { key: "maps.manage", module: "Mapas", label: "Administrar mapas", description: "Gestionar capas y datos del mapa territorial." },
  { key: "ai.execute", module: "Asistente IA", label: "Ejecutar IA interna", description: "Usar la consulta interna al CPU con acceso a material no público." },
  { key: "content.publish", module: "Publicación", label: "Publicar contenido", description: "Publicar contenido visible para la ciudadanía." },
  { key: "users.manage", module: "Administración", label: "Administrar usuarios", description: "Vincular cuentas, cambiar roles, suspender y reactivar usuarios." },
  { key: "roles.manage", module: "Administración", label: "Administrar roles y permisos", description: "Definir roles y qué permisos incluye cada uno." },
  { key: "settings.manage", module: "Administración", label: "Administrar configuraciones", description: "Modificar la configuración general del sistema." },
  { key: "audit.view", module: "Administración", label: "Ver auditoría", description: "Consultar la bitácora de cambios y accesos." }
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];

const ALL_PERMISSIONS = PERMISSION_CATALOG.map((permission) => permission.key);

/** Permisos que el rol Usuario normal (CPU_USER) ejerce como equipo interno: crea y edita
 *  contenido, pero no borra ni administra personas ni configuración. */
const CPU_USER_PERMISSIONS: Permission[] = [
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
  "ai.execute",
  "content.publish"
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  OBSERVER: ["internal.view"],
  CPU_USER: CPU_USER_PERMISSIONS,
  CITIZEN: []
};

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

/** Puede entrar al sistema interno (aunque sea en solo lectura). */
export function canViewInternal(role: UserRole): boolean {
  return hasPermission(role, "internal.view");
}

/**
 * Rol con capacidad de mutar contenido. Es el sucesor del viejo "staff"
 * (ADMIN/OFFICIAL/TECHNICIAN): hoy equivale a ADMIN y CPU_USER, y deja a
 * OBSERVER en solo lectura. Derivado del mapa, no hardcodeado, para que un
 * cambio de permisos no lo desincronice.
 */
export function canMutateContent(role: UserRole): boolean {
  return permissionsForRole(role).some((permission) => permission !== "internal.view");
}
