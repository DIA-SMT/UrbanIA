import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/ingresar?mode=register", request.url), 303);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!name || !email || password.length < 6) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=missing", request.url), 303);
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=unavailable", request.url), 303);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser?.passwordHash) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=exists", request.url), 303);
    }

    const passwordHash = await hashPassword(password);
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { name: existingUser.name || name, passwordHash }
        })
      : await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: UserRole.CITIZEN
          }
        });
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    const token = await createSessionToken({ userId: user.id, role: user.role });

    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return response;
  } catch (error) {
    console.error("Register failed", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/ingresar?mode=register&error=unavailable", request.url), 303);
  }
}
