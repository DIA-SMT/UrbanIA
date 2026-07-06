import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { canAccessAdmin, createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/ingresar?error=missing", request.url), 303);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash) {
    return NextResponse.redirect(new URL("/ingresar?error=credentials", request.url), 303);
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    return NextResponse.redirect(new URL("/ingresar?error=credentials", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(canAccessAdmin(user.role) ? "/admin" : "/", request.url), 303);
  const token = await createSessionToken({ userId: user.id, role: user.role });

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
