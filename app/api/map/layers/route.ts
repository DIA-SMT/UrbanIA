import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const layers = await prisma.urbanLayer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, description: true, geometryType: true, visibleByDefault: true, _count: { select: { features: true } } } });
  return NextResponse.json(layers.map((layer) => ({ ...layer, featureCount: layer._count.features, _count: undefined })), { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
}
