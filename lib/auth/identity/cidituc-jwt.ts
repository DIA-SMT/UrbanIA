/**
 * Verificacion LOCAL del token de Cidituc (HS256 con el secreto compartido).
 *
 * Por que existe: hasta ahora la unica prueba de que un token era autentico era
 * la respuesta del backend de Cidituc. Si ese backend no responde —red, caida,
 * certificado— nadie puede entrar, y ademas un token cualquiera solo se
 * descartaba despues de un viaje de ida y vuelta por la red.
 *
 * Verificando la firma aca: el token falso se rechaza al instante y sin red, y
 * el backend queda para lo que de verdad necesita red (los datos de la persona).
 *
 * El secreto es el JWT_SECRET_KEY del cidituc-backend, el mismo que usa hub-ia
 * en su CIDITUC_JWT_SECRET. Si no esta configurado, la verificacion local no
 * corre y la validacion queda como antes (la hace el backend).
 */

export type CiditucJwtClaims = {
  /** id_persona de Cidituc: el mismo que despues llega en usuarioSinContraseña. */
  id: string;
};

export type JwtVerification =
  | { status: "VALID"; claims: CiditucJwtClaims }
  /** Hay secreto configurado y el token NO pasa: firma mala, expirado o roto. */
  | { status: "INVALID"; reason: string }
  /** Sin secreto configurado: no se puede verificar aca, decide el backend. */
  | { status: "SKIPPED" };

export function hasCiditucJwtSecret() {
  return Boolean(process.env.CIDITUC_JWT_SECRET);
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verifica firma y expiracion. NO decide si la persona puede entrar: eso lo
 * resuelve el resto del flujo (estado de la cuenta, rol, etc.).
 */
export async function verifyCiditucJwt(token: string): Promise<JwtVerification> {
  const secret = process.env.CIDITUC_JWT_SECRET;
  if (!secret) return { status: "SKIPPED" };

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { status: "INVALID", reason: "el token no tiene formato JWT (3 partes)" };
  }
  const [header, body, signature] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const firmaValida = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!firmaValida) {
      return {
        status: "INVALID",
        reason: "firma invalida: CIDITUC_JWT_SECRET no coincide con el JWT_SECRET_KEY del backend"
      };
    }

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as {
      id?: number | string;
      exp?: number;
    };

    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return { status: "INVALID", reason: "token expirado" };
    }

    const id = payload.id != null ? String(payload.id).trim() : "";
    if (!id) {
      return { status: "INVALID", reason: "el payload no trae id de persona" };
    }

    return { status: "VALID", claims: { id } };
  } catch (error) {
    // Un token con base64 o JSON corrupto cae aca: es invalido, no un fallo nuestro.
    return {
      status: "INVALID",
      reason: error instanceof Error ? error.message : "no se pudo leer el token"
    };
  }
}
