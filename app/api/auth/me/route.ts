import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
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

    return NextResponse.json({ user: user ? { name: user.name, role: user.role } : null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
