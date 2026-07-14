import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";

export const CPU_GUEST_COOKIE = "urbania_cpu_guest";

export type CpuOwner = {
  ownerKey: string;
  userId: string | null;
  guestId: string | null;
  // Set when a brand new guest id was generated in this request and still
  // needs to be written back as a cookie on the response.
  mintedGuestId: string | null;
};

/**
 * Resuelve el "dueño" de las conversaciones del CPU. Si hay sesión iniciada
 * usa el usuario; si no, usa un id de invitado guardado en cookie (y lo genera
 * la primera vez). No obliga a loguearse.
 */
export async function resolveCpuOwner(create = false): Promise<CpuOwner> {
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (session) {
    return { ownerKey: `user:${session.userId}`, userId: session.userId, guestId: null, mintedGuestId: null };
  }

  const existingGuest = store.get(CPU_GUEST_COOKIE)?.value ?? null;

  if (existingGuest) {
    return { ownerKey: `guest:${existingGuest}`, userId: null, guestId: existingGuest, mintedGuestId: null };
  }

  if (!create) {
    return { ownerKey: "", userId: null, guestId: null, mintedGuestId: null };
  }

  const guestId = crypto.randomUUID();
  return { ownerKey: `guest:${guestId}`, userId: null, guestId, mintedGuestId: guestId };
}

export function applyOwnerCookie(response: NextResponse, owner: CpuOwner) {
  if (!owner.mintedGuestId) {
    return response;
  }

  response.cookies.set(CPU_GUEST_COOKIE, owner.mintedGuestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}
