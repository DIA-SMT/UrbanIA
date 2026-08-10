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
    };

export interface IdentityProvider {
  readonly id: "cidituc";
  isEnabled(): boolean;
  validateToken(token: string): Promise<IdentityLookupResult>;
}