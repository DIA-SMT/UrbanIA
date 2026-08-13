import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { resolveRolePermissions } from "@/lib/auth/permissions-store";
import { prisma } from "@/lib/db/prisma";


export async function handleMe() {
  try {
    const store = await cookies();
    const session = await readSessionToken(store.get(sessionCookieName)?.value);

    if (!session || !process.env.DATABASE_URL) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, role: true }
    });

    if (!user) return NextResponse.json({ user: null });

    // Los permisos viajan al cliente para que el menú lateral pueda ocultar lo
    // que le va a rebotar. Es cosmético: el permiso real lo valida el servidor
    // en cada página y en cada ruta.
    const permissions = Array.from(await resolveRolePermissions(user.role));

    return NextResponse.json({ user: { name: user.name, role: user.role, permissions } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
