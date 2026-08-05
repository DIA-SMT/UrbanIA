import type { IdentityLookupResult, IdentityProvider } from "@/lib/auth/identity/types";

/**
 * Stub del proveedor SIDITUC. La integración real todavía no existe: este
 * módulo define el contrato y responde NOT_CONFIGURED hasta que haya API y
 * credenciales. Para activarlo: implementar lookupByDni contra el servicio
 * y setear SIDITUC_ENABLED=true (más SIDITUC_API_URL / SIDITUC_API_KEY).
 */
export const siditucProvider: IdentityProvider = {
  id: "sidituc",

  isEnabled() {
    return process.env.SIDITUC_ENABLED === "true";
  },

  async lookupByDni(): Promise<IdentityLookupResult> {
    if (!this.isEnabled()) {
      return { ok: false, error: "NOT_CONFIGURED" };
    }

    // Punto de integración real. Que explote en desarrollo si alguien prende
    // el flag sin implementar la llamada: peor sería simular identidades.
    throw new Error("SIDITUC_ENABLED está activo pero la integración no está implementada.");
  }
};

/** Estado de la integración para la pantalla Configuración > Integración SIDITUC. */
export function siditucIntegrationStatus() {
  return {
    enabled: siditucProvider.isEnabled(),
    apiUrlConfigured: Boolean(process.env.SIDITUC_API_URL),
    apiKeyConfigured: Boolean(process.env.SIDITUC_API_KEY)
  };
}
