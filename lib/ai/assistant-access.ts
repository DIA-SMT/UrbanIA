import "server-only";

import { canViewInternal, getSessionUser } from "@/lib/auth/api";
import type { MigueMode, MigueRole } from "@/lib/ai/migue";

export type AssistantAccess = {
  mode: MigueMode;
  role: MigueRole;
  /** Solo personal municipal con sesion valida y acceso al sistema interno. */
  isStaff: boolean;
};

/**
 * Decide que puede ver el asistente a partir de la sesion, nunca de lo que declara
 * el cliente. El modo interno abre el retrieval a actas, reportes, archivos y notas
 * (ver PUBLIC_SOURCE_KINDS en lib/ai/rag), asi que no puede depender de un campo del
 * body: cualquiera podria mandarlo. Sin sesion municipal, el fallback es publico.
 */
export async function resolveAssistantAccess(): Promise<AssistantAccess> {
  const session = await getSessionUser();

  if (!session || !canViewInternal(session)) {
    return { mode: "public", role: "citizen", isStaff: false };
  }

  return {
    mode: "internal",
    // Este SI sigue mirando el rol, a proposito. `role` no es un permiso: no
    // abre ni cierra ningun dato (eso lo decide `mode`), solo le dice a Migue
    // con quien esta hablando para ajustar el registro de la respuesta.
    // Colgarlo de un permiso del catalogo ataria el tono del asistente a una
    // casilla sin relacion: destildar "Ver auditoria" no deberia cambiarle la
    // forma de contestar a nadie.
    role: session.role === "ADMIN" ? "admin" : "employee",
    isStaff: true
  };
}
