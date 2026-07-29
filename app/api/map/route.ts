import { NextResponse } from "next/server";
import { handleMapFeatures } from "@/lib/gis/api/features";
import { handleMapLayers } from "@/lib/gis/api/layers";

/** Capas y features salen de la base en cada pedido. */
export const dynamic = "force-dynamic";

/*
 * Mapa: capas y features entran por esta unica ruta. El plan Hobby de Vercel
 * admite 12 funciones serverless por deploy y cada route.ts cuenta una.
 *
 * Cada handler vive en lib/gis/api/ con su codigo intacto, incluido el ?layers=
 * que usa features.
 */
export async function GET(request: Request) {
  switch (new URL(request.url).searchParams.get("action") ?? "") {
    case "layers":
      return handleMapLayers();
    case "features":
      return handleMapFeatures(request);
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}
