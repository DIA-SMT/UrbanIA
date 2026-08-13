import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { resolveRolePermissions } from "@/lib/auth/permissions-store";
import type { Permission } from "@/lib/auth/permissions";

export type SessionUser = {
  userId: string;
  role: UserRole;
  /** Permisos del rol, resueltos desde la base UNA vez por request. */
  permissions: ReadonlySet<Permission>;
};

/** Lee la sesion desde la cookie. null si no hay sesion valida. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);
  if (!session) return null;

  return {
    userId: session.userId,
    role: session.role,
    permissions: await resolveRolePermissions(session.role)
  };
});

/**
 * Para los pocos puntos que necesitan evaluar un permiso de un rol que NO es el
 * de la sesión en curso: el callback de Cidituc decide a dónde mandar a la
 * persona antes de que exista la cookie.
 */
export async function roleHasPermission(role: UserRole, permission: Permission): Promise<boolean> {
  return (await resolveRolePermissions(role)).has(permission);
}

export { canViewInternal, hasPermission } from "@/lib/auth/permissions";
