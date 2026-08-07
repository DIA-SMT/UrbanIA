import "server-only";

import type { IdentityLookupResult } from "@/lib/auth/identity/types";

export const ciditucStateCookieName = "urbania_cidituc_state";
export const ciditucFlowMaxAge = 10 * 60;

// Cookies temporales usadas por el flujo anterior. Se eliminan al iniciar o
// completar el acceso para que ningún token viejo quede almacenado.
export const legacyCiditucCookieNames = [
  "urbania_cidituc_verification",
  "urbania_cidituc_pending"
] as const;

export function ciditucErrorCode(error: Extract<IdentityLookupResult, { ok: false }>["error"]) {
  switch (error) {
    case "ACCOUNT_INACTIVE":
      return "cidituc_inactive";
    case "INVALID_TOKEN":
      return "cidituc_invalid";
    case "NOT_CONFIGURED":
    case "UNAVAILABLE":
    default:
      return "cidituc_unavailable";
  }
}
