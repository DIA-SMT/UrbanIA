/** Identidad municipal validada por Cidituc. */
export type CiditucPerson = {
  id: string;
  cuil: string;
  dni: string;
  firstName: string;
  lastName: string;
  email: string | null;
  birthDate: string | null;
  accountStatus: "VERIFIED";
};

export type IdentityLookupResult =
  | { ok: true; person: CiditucPerson }
  | {
      ok: false;
      error: "NOT_CONFIGURED" | "INVALID_TOKEN" | "ACCOUNT_INACTIVE" | "UNAVAILABLE";
      /**
       * id_persona de Cidituc cuando la FIRMA del token se pudo verificar
       * localmente pero el backend no respondio. Prueba que el token es
       * autentico aunque no tengamos los datos de la persona: alcanza para
       * dejar entrar a alguien que ya tiene cuenta, no para crear una nueva.
       */
      verifiedCiditucId?: string;
    };

export interface IdentityProvider {
  readonly id: "cidituc";
  isEnabled(): boolean;
  validateToken(token: string): Promise<IdentityLookupResult>;
}