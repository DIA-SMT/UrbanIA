import type { UserRole } from "@prisma/client";

type SessionPayload = {
  userId: string;
  role: UserRole;
};

const encoder = new TextEncoder();

export const sessionCookieName = "urbania_session";

export function canAccessAdmin(role: UserRole) {
  return role === "ADMIN" || role === "OFFICIAL" || role === "TECHNICIAN";
}

export async function createSessionToken(payload: SessionPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(body);

  return `${body}.${signature}`;
}

export async function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = await sign(body);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(body)) as SessionPayload;
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return toBase64Url(arrayBufferToBase64(signature));
}

function getSessionSecret() {
  return process.env.AUTH_SECRET || process.env.OPENROUTER_API_KEY || "urbania-local-dev-secret";
}

function base64UrlEncode(value: string) {
  return toBase64Url(btoa(value));
}

function base64UrlDecode(value: string) {
  return atob(fromBase64Url(value));
}

function toBase64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const paddedValue = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");

  return paddedValue.replace(/-/g, "+").replace(/_/g, "/");
}

function arrayBufferToBase64(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}
