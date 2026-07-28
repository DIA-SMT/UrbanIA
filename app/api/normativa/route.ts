import { NextResponse } from "next/server";
import { handleArticulos } from "@/lib/normative/api/articulos";
import { handleLinkCreate, handleLinkDelete, handleLinksList } from "@/lib/normative/api/links";
import { handleNormativaSearch } from "@/lib/normative/api/search";

export const dynamic = "force-dynamic";

/*
 * Codigo vigente: articulos, busqueda y anclajes entran por esta unica ruta.
 * El plan Hobby de Vercel admite 12 funciones serverless por deploy y cada
 * route.ts cuenta una.
 *
 * Cada handler vive en lib/normative/api/ con su codigo intacto, incluidos sus
 * propios parametros (?q=, ?number=, ?sourceType=, ?sourceId=, ?id=).
 */
function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function GET(request: Request) {
  switch (accion(request)) {
    case "articulos":
      return handleArticulos(request);
    case "search":
      return handleNormativaSearch(request);
    case "links":
      return handleLinksList(request);
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (accion(request) === "links") return handleLinkCreate(request);
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (accion(request) === "links") return handleLinkDelete(request);
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
