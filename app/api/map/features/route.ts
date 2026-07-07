import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type FeatureRow = { id: string; name: string; properties: Record<string, unknown>; geometry: string; layerName: string; layerSlug: string };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slugs = (params.get("layers") || "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 10);
  const bbox = (params.get("bbox") || "").split(",").map(Number);
  const zoom = Math.max(10, Math.min(20, Number(params.get("zoom")) || 13));
  if (!slugs.length || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return NextResponse.json({ type: "FeatureCollection", features: [] });
  const [west, south, east, north] = bbox;
  const tolerance = zoom < 13 ? 0.00015 : zoom < 15 ? 0.00004 : 0;
  const rows = await prisma.$queryRaw<FeatureRow[]>(Prisma.sql`
    SELECT f."id", f."name", f."properties", l."name" AS "layerName", l."slug" AS "layerSlug",
      ST_AsGeoJSON(${tolerance > 0 ? Prisma.sql`ST_SimplifyPreserveTopology(f."geometry", ${tolerance})` : Prisma.sql`f."geometry"`}) AS "geometry"
    FROM "MapFeature" f JOIN "UrbanLayer" l ON l."id" = f."layerId"
    WHERE l."slug" IN (${Prisma.join(slugs)})
      AND ST_Intersects(f."geometry", ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))
  `);
  return NextResponse.json(
    { type: "FeatureCollection", features: rows.map((row) => ({ type: "Feature", id: row.id, geometry: JSON.parse(row.geometry), properties: { ...withoutImportMetadata(row.properties), _name: row.name, _layer: row.layerName, _layerSlug: row.layerSlug } })) },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } },
  );
}

function withoutImportMetadata(properties: Record<string, unknown>) {
  const usefulProperties = { ...properties };
  delete usefulProperties.path;
  return usefulProperties;
}
