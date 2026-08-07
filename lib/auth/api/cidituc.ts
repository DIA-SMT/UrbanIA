import { UserRole, UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ciditucErrorCode, ciditucFlowMaxAge, ciditucStateCookieName, legacyCiditucCookieNames } from "@/lib/auth/cidituc-flow";
import { canAccessAdmin, createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ciditucProvider } from "@/lib/auth/identity/cidituc";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

function ingresarUrl(request: Request, error: string) {
  return new URL(`/ingresar?error=${error}`, request.url);
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
}

function clearFlowCookies(response: NextResponse) {
  clearCookie(response, ciditucStateCookieName);
  legacyCiditucCookieNames.forEach((name) => clearCookie(response, name));
}

function normalizedBirthDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function syntheticEmail(ciditucId: string) {
  return `cidituc-${ciditucId}@urbania.local`;
}

export async function handleCiditucStart(request: Request) {
  if (!ciditucProvider.isEnabled() || !process.env.CIDITUC_DERIVADOR_URL || !process.env.CIDITUC_CALLBACK_URL) {
    return NextResponse.redirect(ingresarUrl(request, "cidituc_unavailable"), 303);
  }

  const nonce = crypto.randomUUID();
  const ciditucUrl = new URL(process.env.CIDITUC_DERIVADOR_URL);
  ciditucUrl.hash = `/login?${new URLSearchParams({ next: "urbania", state: nonce }).toString()}`;

  const response = NextResponse.redirect(ciditucUrl, 303);
  response.cookies.set(ciditucStateCookieName, nonce, {
    ...cookieOptions,
    maxAge: ciditucFlowMaxAge
  });
  legacyCiditucCookieNames.forEach((name) => clearCookie(response, name));
  return response;
}

export async function handleCiditucCallback(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("auth") ?? "";
  const returnedState = requestUrl.searchParams.get("state") ?? "";
  const store = await cookies();
  const expectedState = store.get(ciditucStateCookieName)?.value ?? "";

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    const response = NextResponse.redirect(ingresarUrl(request, "cidituc_state"), 303);
    clearFlowCookies(response);
    return response;
  }

  const result = await ciditucProvider.validateToken(token);
  if (!result.ok) {
    const response = NextResponse.redirect(ingresarUrl(request, ciditucErrorCode(result.error)), 303);
    clearFlowCookies(response);
    return response;
  }

  try {
    const person = result.person;
    const email = person.email?.toLowerCase() ?? null;
    const [ciditucOwner, dniOwner, emailOwner] = await Promise.all([
      prisma.user.findUnique({ where: { ciditucId: person.id } }),
      prisma.user.findUnique({ where: { dni: person.dni } }),
      email ? prisma.user.findUnique({ where: { email } }) : Promise.resolve(null)
    ]);

    const owners = [ciditucOwner, dniOwner, emailOwner].filter(Boolean);
    const ownerIds = new Set(owners.map((owner) => owner!.id));
    if (ownerIds.size > 1) {
      const response = NextResponse.redirect(ingresarUrl(request, "cidituc_conflict"), 303);
      clearFlowCookies(response);
      return response;
    }

    const existingUser = ciditucOwner ?? dniOwner ?? emailOwner;
    if (existingUser?.ciditucId && existingUser.ciditucId !== person.id) {
      const response = NextResponse.redirect(ingresarUrl(request, "cidituc_conflict"), 303);
      clearFlowCookies(response);
      return response;
    }

    const matchedOnlyByEmail = Boolean(existingUser && !ciditucOwner && !dniOwner && emailOwner);
    if (matchedOnlyByEmail && existingUser?.dni && existingUser.dni !== person.dni) {
      const response = NextResponse.redirect(ingresarUrl(request, "cidituc_conflict"), 303);
      clearFlowCookies(response);
      return response;
    }

    if (existingUser && existingUser.status !== UserStatus.ACTIVE) {
      const response = NextResponse.redirect(ingresarUrl(request, "blocked"), 303);
      clearFlowCookies(response);
      return response;
    }

    const birthDate = normalizedBirthDate(person.birthDate);
    const now = new Date();
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ciditucId: person.id,
            ciditucVerifiedAt: now,
            name: person.firstName,
            lastName: person.lastName || existingUser.lastName,
            email: email ?? existingUser.email,
            dni: person.dni,
            birthDate: birthDate ?? existingUser.birthDate,
            lastLoginAt: now
          }
        })
      : await prisma.user.create({
          data: {
            ciditucId: person.id,
            ciditucVerifiedAt: now,
            name: person.firstName,
            lastName: person.lastName || null,
            email: email ?? syntheticEmail(person.id),
            dni: person.dni,
            birthDate,
            role: UserRole.CITIZEN,
            status: UserStatus.ACTIVE,
            lastLoginAt: now
          }
        });

    const session = await createSessionToken({ userId: user.id, role: user.role });
    const response = NextResponse.redirect(new URL(canAccessAdmin(user.role) ? "/admin" : "/", request.url), 303);
    response.cookies.set(sessionCookieName, session, { ...cookieOptions, maxAge: 60 * 60 * 8 });
    clearFlowCookies(response);
    return response;
  } catch (error) {
    console.error("No se pudo crear o vincular la cuenta de Cidituc.", error instanceof Error ? error.message : error);
    const response = NextResponse.redirect(ingresarUrl(request, "cidituc_session_failed"), 303);
    clearFlowCookies(response);
    return response;
  }
}
