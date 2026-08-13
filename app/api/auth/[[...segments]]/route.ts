import { NextResponse } from "next/server";
import { handleLogout } from "@/lib/auth/api/logout";
import { handleMe } from "@/lib/auth/api/me";
import { handleCiditucCallback, handleCiditucStart } from "@/lib/auth/api/cidituc";

export const dynamic = "force-dynamic";

/*
 * El acceso Cidituc, cierre de sesión y "quién soy" entran por esta única ruta,
 * con la operacion en el query param `action`. Mismo motivo que en el resto de
 * la app: el plan Hobby de Vercel admite 12 funciones serverless por deploy y
 * cada route.ts cuenta una.
 *
 * La autenticación local por correo y contraseña fue retirada: Cidituc es el
 * único proveedor de identidad y el callback aprovisiona la cuenta de UrbanIA.
 *
 * Es un catch-all OPCIONAL por el callback de Cidituc. La URL que el Derivador
 * tiene registrada del lado de Cidituc es /auth/cidituc/callback y NO se puede
 * cambiar sin coordinar con ellos, pero tampoco merecia una funcion serverless
 * propia para siete lineas que llaman al mismo handler que ya vive aca. Ahora
 * next.config.ts la reescribe a /api/auth/cidituc-callback: se reescribe a un
 * SEGMENTO y no a `?action=` porque el query inyectado en un rewrite no le llega
 * al handler (probado en dev), mientras que el segmento si, por params.
 */
type Segments = { params: Promise<{ segments?: string[] }> };

function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function POST(request: Request) {
  switch (accion(request)) {
    case "logout":
      return handleLogout();
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}

export async function GET(request: Request, { params }: Segments) {
  // El callback llega por segmento (viene reescrito de /auth/cidituc/callback);
  // el resto de las operaciones, por `?action=`.
  if ((await params).segments?.[0] === "cidituc-callback") {
    return handleCiditucCallback(request);
  }

  switch (accion(request)) {
    case "me":
      return handleMe();
    case "cidituc-start":
      return handleCiditucStart(request);
    case "cidituc-callback":
      return handleCiditucCallback(request);
    default: {
      return NextResponse.redirect(new URL("/ingresar", request.url), 303);
    }
  }
}
