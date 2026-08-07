import { z } from "zod";
import type { IdentityLookupResult, IdentityProvider } from "@/lib/auth/identity/types";

const flagSchema = z.union([z.boolean(), z.number(), z.string()]).nullish();

const ciditucResponseSchema = z.object({
  usuarioSinContraseña: z
    .object({
      id_persona: z.union([z.number(), z.string()]),
      documento_persona: z.union([z.number(), z.string()]),
      nombre_persona: z.string().trim().min(1),
      apellido_persona: z.string().trim().nullable().optional(),
      email_persona: z.string().trim().nullable().optional(),
      fecha_nacimiento_persona: z.string().nullable().optional(),
      validado: flagSchema,
      habilita: flagSchema
    })
    .passthrough()
});

function enabledFlag(value: boolean | number | string) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  const numeric = Number(normalized);
  return normalized !== "" && Number.isFinite(numeric) && numeric > 0;
}

function onlyDigits(value: string | number) {
  return String(value).replace(/\D/g, "");
}

function cuilToDni(cuil: string) {
  return cuil.length === 11 ? cuil.slice(2, -1) : cuil;
}

function normalizedBirthDate(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) return null;

  const normalized = match[0];
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

export const ciditucProvider: IdentityProvider = {
  id: "cidituc",

  isEnabled() {
    return process.env.CIDITUC_ENABLED === "true";
  },

  async validateToken(rawToken: string): Promise<IdentityLookupResult> {
    if (!this.isEnabled() || !process.env.CIDITUC_API_URL) {
      return { ok: false, error: "NOT_CONFIGURED" };
    }

    const token = rawToken.trim();
    if (token.length < 20 || token.length > 4096 || /\s/.test(token)) {
      return { ok: false, error: "INVALID_TOKEN" };
    }

    try {
      const apiUrl = process.env.CIDITUC_API_URL.replace(/\/$/, "");
      const response = await fetch(`${apiUrl}/usuarios/authStatus`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: token },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
      });

      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "INVALID_TOKEN" };
      }
      if (!response.ok) {
        return { ok: false, error: "UNAVAILABLE" };
      }

      const parsed = ciditucResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        console.error("Respuesta inesperada de Cidituc.", parsed.error.flatten());
        return { ok: false, error: "UNAVAILABLE" };
      }

      const user = parsed.data.usuarioSinContraseña;
      // El login de Cidituc ya impide emitir el token para una cuenta con valor
      // 0. Algunas cuentas históricas usan otros valores positivos y algunas
      // respuestas no incluyen estos campos; solo rechazamos una baja explícita.
      if (
        (user.validado != null && !enabledFlag(user.validado)) ||
        (user.habilita != null && !enabledFlag(user.habilita))
      ) {
        return { ok: false, error: "ACCOUNT_INACTIVE" };
      }

      const cuil = onlyDigits(user.documento_persona);
      if (cuil.length !== 11) {
        return { ok: false, error: "UNAVAILABLE" };
      }

      return {
        ok: true,
        person: {
          id: String(user.id_persona),
          cuil,
          dni: cuilToDni(cuil),
          firstName: user.nombre_persona.trim(),
          lastName: user.apellido_persona?.trim() ?? "",
          email: user.email_persona?.trim().toLowerCase() || null,
          birthDate: normalizedBirthDate(user.fecha_nacimiento_persona),
          accountStatus: "VERIFIED"
        }
      };
    } catch (error) {
      console.error("No se pudo validar el token con Cidituc.", error instanceof Error ? error.message : error);
      return { ok: false, error: "UNAVAILABLE" };
    }
  }
};

export function ciditucIntegrationStatus() {
  return {
    enabled: ciditucProvider.isEnabled(),
    derivadorUrlConfigured: Boolean(process.env.CIDITUC_DERIVADOR_URL),
    apiUrlConfigured: Boolean(process.env.CIDITUC_API_URL),
    callbackUrlConfigured: Boolean(process.env.CIDITUC_CALLBACK_URL)
  };
}
