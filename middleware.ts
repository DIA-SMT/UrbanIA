import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessAdmin, readSessionToken, sessionCookieName } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
