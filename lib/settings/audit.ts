/**
 * Acciones válidas de la bitácora de usuarios. En base es texto plano para
 * poder sumar acciones sin migrar; este módulo es la única fuente de verdad
 * de los valores y sus etiquetas.
 */

export const AUDIT_ACTIONS = {
  /// Ya no se genera: las cuentas nacen en el primer ingreso con Cidituc. Se
  /// conserva la etiqueta para que los registros historicos se lean bien.
  USER_CREATED: "Alta manual",
  ROLE_CHANGED: "Cambio de rol",
  USER_SUSPENDED: "Suspensión",
  USER_REACTIVATED: "Reactivación",
  ACCESS_REVOKED: "Acceso revocado",
  PROFILE_UPDATED: "Perfil actualizado",
  ACCESS_REQUEST_APPROVED: "Solicitud aprobada",
  ACCESS_REQUEST_REJECTED: "Solicitud rechazada",
  /// Cambios de la matriz rol -> permiso. No tienen usuario afectado: el cambio
  /// es sobre un ROL, y le pega a todas las cuentas que lo tengan. La pantalla de
  /// auditoría ya muestra "—" cuando targetUser es null.
  ROLE_PERMISSION_GRANTED: "Permiso concedido",
  ROLE_PERMISSION_REVOKED: "Permiso revocado"
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action as AuditAction] ?? action;
}
