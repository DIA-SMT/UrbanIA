import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Deteccion best-effort del distrito que contiene un punto, via PostGIS. Como
 * District.geometry es Unsupported("geometry"), se resuelve con $queryRaw. Si la
 * geometria no esta cargada o la query falla, devuelve district: null sin romper.
 */
export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ district: null });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ district: null });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; code: string; name: string | null }>>`
      SELECT "id", "code", "name"
      FROM "District"
      WHERE "geometry" IS NOT NULL
        AND ST_Contains("geometry", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      LIMIT 1
    `;
    const district = rows[0] ?? null;
    return NextResponse.json({ district: district ? { id: district.id, code: district.code, name: district.name } : null });
  } catch (error) {
    console.warn("Deteccion de distrito no disponible", error instanceof Error ? error.message : error);
    return NextResponse.json({ district: null });
  }
}
