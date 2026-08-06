import type { UserRole, UserStatus } from "@prisma/client";

/** Etiquetas y estilos compartidos del módulo Configuración > Usuarios y Accesos. */

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  OBSERVER: "Consulta",
  CPU_USER: "Usuario normal",
  CITIZEN: "Ciudadano"
};

export const roleDescriptions: Record<UserRole, string> = {
  ADMIN: "Acceso total: gestiona usuarios, roles, permisos, configuraciones y auditoría.",
  OBSERVER: "Solo consulta del sistema interno: proyectos, reuniones, documentos y mapas, sin editar.",
  CPU_USER: "Usuario interno municipal: crea y edita contenido, carga documentación y colabora entre áreas.",
  CITIZEN: "Accede al portal público: se registra, presenta propuestas y consulta su estado."
};

/** Orden fijo para selects y matrices: de más a menos privilegio. */
export const ROLE_ORDER: UserRole[] = ["ADMIN", "CPU_USER", "OBSERVER", "CITIZEN"];

export const statusLabels: Record<UserStatus, string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  REVOKED: "Revocado",
  INACTIVE: "Inactivo"
};

/**
 * Colores institucionales por estado. Azul = en proceso, verde = operativo,
 * ámbar = detenido temporalmente, rosa = sin acceso, gris = sin actividad.
 * Cada badge lleva texto además del color (no se comunica solo con color).
 */
export const statusBadgeClasses: Record<UserStatus, string> = {
  PENDING: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200",
  ACTIVE: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200",
  SUSPENDED: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
  REVOKED: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200",
  INACTIVE: "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300"
};

export const roleBadgeClasses: Record<UserRole, string> = {
  ADMIN: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200",
  CPU_USER: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-200",
  OBSERVER: "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300",
  CITIZEN: "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-400/40 dark:bg-teal-400/10 dark:text-teal-200"
};

export function fullName(user: { name: string; lastName: string | null }): string {
  return user.lastName ? `${user.name} ${user.lastName}` : user.name;
}

export function initials(user: { name: string; lastName: string | null }): string {
  const first = user.name.trim().charAt(0);
  const second = user.lastName?.trim().charAt(0) ?? user.name.trim().split(/\s+/)[1]?.charAt(0) ?? "";
  return `${first}${second}`.toUpperCase() || "?";
}
