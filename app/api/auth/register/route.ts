import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/ingresar?mode=register", request.url), 303);
}

/** Edad cumplida a hoy. Devuelve null si la fecha no es válida o es futura. */
function ageFrom(birthDate: Date): number | null {
  const now = new Date();

  if (Number.isNaN(birthDate.getTime()) || birthDate > now) {
    return null;
  }

  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const dni = String(formData.get("dni") || "").trim();
    const birthDateRaw = String(formData.get("birthDate") || "").trim();
    const occupation = String(formData.get("occupation") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!name || !dni || !birthDateRaw || !occupation || !email || password.length < 6) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=missing", request.url), 303);
    }

    if (!/^\d{7,9}$/.test(dni.replace(/\D/g, "")) || dni.replace(/\D/g, "").length < 7) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=dni", request.url), 303);
    }

    const birthDate = new Date(`${birthDateRaw}T00:00:00`);
    const age = ageFrom(birthDate);

    if (age === null) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=birthdate", request.url), 303);
    }

    if (age < 18) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=minor", request.url), 303);
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=unavailable", request.url), 303);
    }

    const normalizedDni = dni.replace(/\D/g, "");
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser?.passwordHash) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=exists", request.url), 303);
    }

    // El DNI es único: si ya está tomado por otra cuenta, no se puede registrar.
    const dniOwner = await prisma.user.findUnique({ where: { dni: normalizedDni } });

    if (dniOwner && dniOwner.id !== existingUser?.id) {
      return NextResponse.redirect(new URL("/ingresar?mode=register&error=dni_taken", request.url), 303);
    }

    const passwordHash = await hashPassword(password);
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { name: existingUser.name || name, passwordHash, dni: normalizedDni, birthDate, occupation }
        })
      : await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            dni: normalizedDni,
            birthDate,
            occupation,
            // Las cuentas nuevas son siempre de vecino: el rol municipal lo asigna
            // el equipo, nunca el formulario público.
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
