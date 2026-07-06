import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || password.length < 6) {
    return NextResponse.redirect(new URL("/ingresar?mode=register&error=missing", request.url), 303);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.redirect(new URL("/ingresar?mode=register&error=exists", request.url), 303);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.CITIZEN
    }
  });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  const token = await createSessionToken({ userId: user.id, role: user.role });

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
