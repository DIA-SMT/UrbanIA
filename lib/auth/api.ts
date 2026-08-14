import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { resolveRolePermissions } from "@/lib/auth/permissions-store";
import type { Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { fullName } from "@/lib/settings/shared";

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

export type SessionActor = SessionUser & {
  /** Nombre de la cuenta, para sellar lo que la persona vota o firma. */
  name: string;
};

/**
 * La sesión más el nombre de la cuenta.
 *
 * Aparte de `getSessionUser` porque cuesta una consulta: solo lo piden las
 * pantallas y las rutas que atribuyen algo a una persona (el voto de una norma,
 * una devolución, la autoría). El resto sigue resolviendo permisos sin tocar la
 * base. `cache` lo deja en una sola consulta por request aunque lo llamen varios.
 *
 * Devuelve null también cuando la cuenta ya no existe: un userId apuntando a una
 * cuenta borrada tiene que cortar el flujo con un 401 entendible, y no explotar
 * por clave foránea recién al momento de escribir.
 */
export const getSessionActor = cache(async (): Promise<SessionActor | null> => {
  const session = await getSessionUser();
  if (!session || !process.env.DATABASE_URL) return null;

  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, lastName: true }
  });
  if (!account) return null;

  return { ...session, name: fullName(account) };
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
