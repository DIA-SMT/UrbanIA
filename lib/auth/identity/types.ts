/**
 * Capa de identidad de UrbanIA. La identidad (quién sos) es de SIDITUC;
 * UrbanIA solo autoriza (qué podés hacer). Mientras la integración no esté
 * activa, el proveedor local (email + contraseña) sigue operando.
 */

export type IdentityProviderId = "local" | "sidituc";

export type SiditucPerson = {
  dni: string;
  firstName: string;
  lastName: string;
  email: string | null;
  /** Estado de la cuenta en el padrón municipal. */
  accountStatus: "VERIFIED" | "UNVERIFIED" | "NOT_FOUND";
};

export type IdentityLookupResult =
  | { ok: true; person: SiditucPerson }
  | { ok: false; error: "NOT_CONFIGURED" | "NOT_FOUND" | "UNAVAILABLE" };

export interface IdentityProvider {
  readonly id: IdentityProviderId;
  /** true cuando el proveedor está operativo en este entorno. */
  isEnabled(): boolean;
  /** Busca una persona por DNI en la fuente de identidad. */
  lookupByDni(dni: string): Promise<IdentityLookupResult>;
}
