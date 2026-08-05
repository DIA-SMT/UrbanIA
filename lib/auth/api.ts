import "server-only";

import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { canMutateContent } from "@/lib/auth/permissions";

export type SessionUser = { userId: string; role: UserRole };

/** Lee la sesion desde la cookie. null si no hay sesion valida. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);
  return session ? { userId: session.userId, role: session.role } : null;
}

/**
 * Puede crear/editar contenido interno (ADMIN y CPU_USER). OBSERVER entra al
 * sistema pero en solo lectura; para gates de solo visualización usar
 * `canViewInternal` de lib/auth/permissions.
 */
export function isStaff(role: UserRole): boolean {
  return canMutateContent(role);
}

export { canViewInternal, hasPermission } from "@/lib/auth/permissions";
