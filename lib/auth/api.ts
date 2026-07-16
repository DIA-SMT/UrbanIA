import "server-only";

import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";

export type SessionUser = { userId: string; role: UserRole };

const STAFF_ROLES: UserRole[] = ["ADMIN", "OFFICIAL", "TECHNICIAN"];

/** Lee la sesion desde la cookie. null si no hay sesion valida. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);
  return session ? { userId: session.userId, role: session.role } : null;
}

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
