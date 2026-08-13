import { NextResponse } from "next/server";
import { handleMapFeatures } from "@/lib/gis/api/features";
import { handleMapLayers } from "@/lib/gis/api/layers";
import { handleArticulos } from "@/lib/normative/api/articulos";
import { handleLinkCreate, handleLinkDelete, handleLinksList } from "@/lib/normative/api/links";
import { handleNormativaSearch } from "@/lib/normative/api/search";

export const dynamic = "force-dynamic";

/*
 * Codigo vigente: articulos, busqueda y anclajes entran por esta unica ruta.
 * El plan Hobby de Vercel admite 12 funciones serverless por deploy y cada
 * route.ts cuenta una.
 *
 * Tambien entran las CAPAS DEL MAPA (layers/features), que antes tenian su
 * propio /api/map: son lectura de datos urbanos igual que el resto, no traen
 * dependencias propias y sus `action` no se pisan con las de aca. El cliente
 * sigue llamando a /api/map, que next.config.ts reescribe hasta esta ruta.
 *
 * Cada handler vive en lib/normative/api/ y lib/gis/api/ con su codigo intacto,
 * incluidos sus propios parametros (?q=, ?number=, ?sourceType=, ?sourceId=,
 * ?id=, ?layers=).
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
    case "layers":
      return handleMapLayers();
    case "features":
      return handleMapFeatures(request);
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
