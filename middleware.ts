import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessAdmin, readSessionToken, sessionCookieName } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (session && canAccessAdmin(session.role)) {
    return NextResponse.next();
  }

  // Las rutas de API responden 401 en JSON. Un redirect a /ingresar le llegaria al
  // fetch como HTML y el cliente lo reportaria como un error de parseo confuso;
  // con este cuerpo, el chat del CPU muestra el detail tal cual.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Sesion requerida",
        detail: "Ingresá con tu cuenta municipal para usar la consulta normativa."
      },
      { status: 401 }
    );
  }

  return NextResponse.redirect(new URL("/ingresar", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/consulta-cpu/:path*", "/api/cpu/:path*"]
};
