import "server-only";

import { cookies } from "next/headers";
import { canAccessAdmin, readSessionToken, sessionCookieName } from "@/lib/auth/session";
import type { MigueMode, MigueRole } from "@/lib/ai/migue";

export type AssistantAccess = {
  mode: MigueMode;
  role: MigueRole;
  /** Solo personal municipal con sesion valida (ADMIN, OFFICIAL o TECHNICIAN). */
  isStaff: boolean;
};

/**
 * Decide que puede ver el asistente a partir de la sesion, nunca de lo que declara
 * el cliente. El modo interno abre el retrieval a actas, reportes, archivos y notas
 * (ver PUBLIC_SOURCE_KINDS en lib/ai/rag), asi que no puede depender de un campo del
 * body: cualquiera podria mandarlo. Sin sesion municipal, el fallback es publico.
 */
export async function resolveAssistantAccess(): Promise<AssistantAccess> {
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (!session || !canAccessAdmin(session.role)) {
    return { mode: "public", role: "citizen", isStaff: false };
  }

  return {
    mode: "internal",
    role: session.role === "ADMIN" ? "admin" : "employee",
    isStaff: true
  };
}
