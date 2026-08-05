import "server-only";

import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/api";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

/**
 * Guards del módulo Configuración. El middleware ya exige sesión interna para
 * /admin/*, pero Configuración pide además el permiso concreto: un Observador
 * o Usuario CPU navega el sistema y aun así no debe ver este módulo.
 */

/** Para páginas: redirige si falta sesión o permiso. */
export async function requireSettingsAccess(permission: Permission = "users.manage"): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!hasPermission(session.role, permission)) redirect("/admin");
  return session;
}

/** Para rutas de API: null si falta sesión o permiso; la ruta responde 401/403. */
export async function getSettingsSession(permission: Permission = "users.manage"): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (!session || !hasPermission(session.role, permission)) return null;
  return session;
}

/** IP y dispositivo del request, para la bitácora. */
export function requestMetadata(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  return { ip, userAgent: request.headers.get("user-agent") };
}
