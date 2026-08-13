import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(sessionCookieName)?.value);

  // Solo presencia de sesion. El chequeo de PERMISO ya no puede vivir aca: la
  // matriz rol -> permiso esta en la base y este archivo corre en el runtime
  // Edge, donde Prisma no existe. Una copia de la matriz en Edge seria una
  // autoridad sombra que se desincroniza de lo que muestra la pantalla de
  // permisos, y falla ABIERTA (dejaria pasar a un rol al que le acaban de
  // revocar el acceso).
  //
  // El permiso lo exige cada pagina y cada ruta con su propio guard. Eso ahora
  // es cierto de verdad: las cuatro rutas que dependian solo de esta barrera
  // (/admin, /consulta-cpu, /api/cpu y /admin/configuracion) tienen guard propio.
  if (session) {
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

/*
 * Todo el sistema interno se corta ACA, antes de renderizar: asi una visita sin
 * sesion recibe un 307 limpio a /ingresar en vez de un 200 con la redireccion
 * adentro del payload (que es lo que devuelve `redirect()` desde la pagina).
 * Los guards de cada pagina siguen igual: esto es la primera barrera, no la
 * unica.
 *
 * Ojo con los prefijos: "/audiencias/:path*" NO alcanza a /audiencias-publicas,
 * que es el registro del portal ciudadano y debe seguir abierto (path-to-regexp
 * corta por segmento, y "audiencias-publicas" es otro segmento).
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/consulta-cpu/:path*",
    "/api/cpu/:path*",
    "/normas/:path*",
    "/audiencias/:path*",
    "/participacion/:path*",
    "/foro/:path*"
  ]
};
