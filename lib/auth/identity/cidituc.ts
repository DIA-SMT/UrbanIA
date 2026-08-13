import { z } from "zod";
import type { IdentityLookupResult, IdentityProvider } from "@/lib/auth/identity/types";
import { verifyCiditucJwt } from "@/lib/auth/identity/cidituc-jwt";
import { getDeCidituc, motivoDeFallo } from "@/lib/auth/identity/cidituc-https";

const flagSchema = z.union([z.boolean(), z.number(), z.string()]).nullish();

/**
 * El backend hace `SELECT p.*` sobre MySQL, asi que un campo con columna
 * numerica llega como numero y una columna vacia llega como null. Exigir string
 * descartaba personas validas en silencio: todo el parseo fallaba y el usuario
 * veia "Cidituc no esta disponible" con el backend andando perfecto.
 */
const textoDeCidituc = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((valor) => {
    if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : null;
    const limpio = valor?.trim() ?? "";
    return limpio === "" ? null : limpio;
  });

/** Sin id ni documento no hay nada que hacer; el resto es tolerante. */
const personaSchema = z
  .object({
    id_persona: z.union([z.number(), z.string()]),
    documento_persona: z.union([z.number(), z.string()]),
    nombre_persona: textoDeCidituc,
    apellido_persona: textoDeCidituc,
    email_persona: textoDeCidituc,
    fecha_nacimiento_persona: textoDeCidituc,
    validado: flagSchema,
    habilita: flagSchema
  })
  .passthrough();

/**
 * Cada endpoint de Cidituc envuelve a la persona con una clave distinta:
 * /usuarios/authStatus usa `usuarioSinContraseña` (ciudadanos, el que usamos) y
 * /usuarios/authStatusIA usa `user` (empleados municipales). Se aceptan las dos
 * y tambien la forma plana, por si el backend cambia.
 */
function desenvolverPersona(cuerpo: unknown): unknown {
  if (!cuerpo || typeof cuerpo !== "object") return cuerpo;
  const contenedor = cuerpo as Record<string, unknown>;
  return contenedor["usuarioSinContraseña"] ?? contenedor["user"] ?? contenedor;
}

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

    // Primero la firma, que se verifica sin red: un token falso se descarta acá
    // mismo y nunca llega al backend. Si no hay secreto configurado, la
    // verificación queda como estaba (la hace el backend).
    const verificacion = await verifyCiditucJwt(token);
    if (verificacion.status === "INVALID") {
      console.error("Token de Cidituc rechazado localmente:", verificacion.reason);
      return { ok: false, error: "INVALID_TOKEN" };
    }
    const verifiedCiditucId = verificacion.status === "VALID" ? verificacion.claims.id : undefined;

    try {
      const apiUrl = process.env.CIDITUC_API_URL.replace(/\/$/, "");
      const response = await getDeCidituc(`${apiUrl}/usuarios/authStatus`, token, 10_000);

      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "INVALID_TOKEN" };
      }
      if (response.status < 200 || response.status >= 300) {
        // Con el host y el status en el log se distingue de un vistazo si la
        // URL apunta a otro lado (404) o si el backend esta caido (5xx). Sin
        // esto, todo llega a la pantalla como un "no disponible" mudo.
        console.error(
          `Cidituc respondio ${response.status} en ${new URL(apiUrl).host}/usuarios/authStatus. ` +
            "Si es 404, CIDITUC_API_URL apunta a un host que no sirve ese endpoint."
        );
        return { ok: false, error: "UNAVAILABLE", verifiedCiditucId };
      }

      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(response.body);
      } catch {
        console.error("Cidituc respondio 2xx con algo que no es JSON.");
        return { ok: false, error: "UNAVAILABLE", verifiedCiditucId };
      }

      const parsed = personaSchema.safeParse(desenvolverPersona(cuerpo));
      if (!parsed.success) {
        // Solo los NOMBRES de los campos que fallaron: el cuerpo trae datos de
        // la persona y no tiene por que quedar en los logs del hosting.
        console.error(
          "Respuesta inesperada de Cidituc. Campos con problema:",
          Object.keys(parsed.error.flatten().fieldErrors).join(", ") || "(forma general)"
        );
        return { ok: false, error: "UNAVAILABLE", verifiedCiditucId };
      }

      const user = parsed.data;
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
        // Era el unico camino de falla completamente mudo: cartel de "no
        // disponible" con el backend respondiendo 200. Se loguea el largo, no el
        // documento.
        console.error(
          `Cidituc devolvio un documento_persona de ${cuil.length} digitos; se esperaba un CUIL de 11.`
        );
        return { ok: false, error: "UNAVAILABLE", verifiedCiditucId };
      }

      return {
        ok: true,
        person: {
          id: String(user.id_persona),
          cuil,
          dni: cuilToDni(cuil),
          firstName: user.nombre_persona ?? "",
          lastName: user.apellido_persona ?? "",
          email: user.email_persona?.toLowerCase() ?? null,
          birthDate: normalizedBirthDate(user.fecha_nacimiento_persona),
          accountStatus: "VERIFIED"
        }
      };
    } catch (error) {
      // Acá caen los fallos de red: DNS, timeout, TLS o un firewall que no deja
      // salir a ese host desde donde corre la app. Se registra el host y el
      // motivo para poder distinguirlo de una URL mal escrita.
      const host = (() => {
        try {
          return new URL(process.env.CIDITUC_API_URL ?? "").host;
        } catch {
          return process.env.CIDITUC_API_URL ?? "(sin CIDITUC_API_URL)";
        }
      })();
      console.error(`No se pudo conectar con Cidituc en ${host}: ${motivoDeFallo(error)}`);
      return { ok: false, error: "UNAVAILABLE", verifiedCiditucId };
    }
  }
};

/**
 * La prueba de conexion contra el backend vivia acá, para la pantalla de
 * Configuración > Cidituc que se eliminó. El mismo chequeo se hace a mano y
 * está documentado en docs/integracion-cidituc.md: un GET a
 * {CIDITUC_API_URL}/usuarios/authStatus con un token inválido tiene que
 * responder 401.
 */
export function ciditucIntegrationStatus() {
  return {
    enabled: ciditucProvider.isEnabled(),
    derivadorUrlConfigured: Boolean(process.env.CIDITUC_DERIVADOR_URL),
    apiUrlConfigured: Boolean(process.env.CIDITUC_API_URL),
    callbackUrlConfigured: Boolean(process.env.CIDITUC_CALLBACK_URL)
  };
}
