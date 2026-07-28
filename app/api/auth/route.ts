import { NextResponse } from "next/server";
import { handleLogin } from "@/lib/auth/api/login";
import { handleLogout } from "@/lib/auth/api/logout";
import { handleMe } from "@/lib/auth/api/me";
import { handleRegister } from "@/lib/auth/api/register";

export const dynamic = "force-dynamic";

/*
 * Login, registro, cierre de sesion y "quien soy" entran por esta unica ruta,
 * con la operacion en el query param `action`. Mismo motivo que en el resto de
 * la app: el plan Hobby de Vercel admite 12 funciones serverless por deploy y
 * cada route.ts cuenta una.
 *
 * Cada handler vive en lib/auth/api/ con su codigo intacto.
 *
 * Login y registro se envian desde formularios HTML sin JavaScript, asi que la
 * accion tiene que viajar en la URL del `action=` del <form>: es lo unico que
 * el navegador manda aparte de los campos.
 */
function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function POST(request: Request) {
  switch (accion(request)) {
    case "login":
      return handleLogin(request);
    case "register":
      return handleRegister(request);
    case "logout":
      return handleLogout();
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  if (accion(request) === "me") return handleMe();
  // Entrar a mano a /api/auth?action=login desde la barra del navegador manda
  // un GET; se devuelve a la pantalla de ingreso en vez de dar un 400 seco.
  const modo = accion(request) === "register" ? "?mode=register" : "";
  return NextResponse.redirect(new URL(`/ingresar${modo}`, request.url), 303);
}
