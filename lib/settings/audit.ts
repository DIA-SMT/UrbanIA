/**
 * Acciones válidas de la bitácora de usuarios. En base es texto plano para
 * poder sumar acciones sin migrar; este módulo es la única fuente de verdad
 * de los valores y sus etiquetas.
 */

export const AUDIT_ACTIONS = {
  ROLE_CHANGED: "Cambio de rol",
  USER_SUSPENDED: "Suspensión",
  USER_REACTIVATED: "Reactivación",
  ACCESS_REVOKED: "Acceso revocado",
  PROFILE_UPDATED: "Perfil actualizado",
  ACCESS_REQUEST_APPROVED: "Solicitud aprobada",
  ACCESS_REQUEST_REJECTED: "Solicitud rechazada"
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action as AuditAction] ?? action;
}
