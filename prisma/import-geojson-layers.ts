import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { GeometryType, Prisma, PrismaClient } from "@prisma/client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const prisma = new PrismaClient({ datasources: { db: { url: withSingleConnection(process.env.DATABASE_URL || "") } } });
const base = "C:\\Users\\lucas\\OneDrive\\Escritorio\\Info para UrbanIA";
const sources = [
  { path: `${base}\\Calles.geojson`, slug: "calles", name: "Calles", type: GeometryType.LINESTRING, visible: false },
  { path: `${base}\\Educación.geojson`, slug: "educacion", name: "Educación", type: GeometryType.POINT, visible: false },
  { path: `${base}\\Espacios Verdes.geojson`, slug: "espacios-verdes", name: "Espacios verdes", type: GeometryType.POINT, visible: false },
  { path: `${base}\\Manzanas.geojson`, slug: "manzanas", name: "Manzanas", type: GeometryType.MULTIPOLYGON, visible: false },
  { path: `${base}\\Salud.geojson`, slug: "salud", name: "Salud", type: GeometryType.POINT, visible: false }
];

async function main() {
  for (const source of sources) {
    const collection = JSON.parse(await readFile(source.path, "utf8")) as FeatureCollection;
    if (collection.type !== "FeatureCollection") throw new Error(`${basename(source.path)} no es FeatureCollection`);
    const layer = await prisma.urbanLayer.upsert({ where: { slug: source.slug }, update: { name: source.name, geometryType: source.type, visibleByDefault: source.visible, description: `Fuente municipal importada desde ${basename(source.path)}` }, create: { name: source.name, slug: source.slug, geometryType: source.type, visibleByDefault: source.visible, description: `Fuente municipal importada desde ${basename(source.path)}` } });
    await prisma.mapFeature.deleteMany({ where: { layerId: layer.id } });
    let imported = 0;
    for (let index = 0; index < collection.features.length; index += 100) {
      const batch = collection.features.slice(index, index + 100).filter((feature): feature is Feature<Geometry> => Boolean(feature.geometry));
      if (!batch.length) continue;
      const rows = batch.map((feature, offset) => {
        const properties = (feature.properties ?? {}) as Record<string, unknown>;
        const name = featureName(properties, source.name, index + offset + 1);
        return Prisma.sql`(${randomUUID()}, ${layer.id}, ${name}, ${source.name}, ${JSON.stringify(properties)}::jsonb, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}), 4326))`;
      });
      await prisma.$executeRaw(Prisma.sql`INSERT INTO "MapFeature" ("id", "layerId", "name", "description", "properties", "geometry") VALUES ${Prisma.join(rows)}`);
      imported += batch.length;
      if (imported % 5000 === 0 || imported === collection.features.length) console.log(`${source.name}: ${imported}/${collection.features.length}`);
    }
  }
}

function featureName(properties: Record<string, unknown>, layer: string, index: number) {
  for (const key of ["NOMBRE", "Nombre", "Name", "CALLE", "MANZANA", "parcela", "padron_m", "ID"]) {
    const value = properties[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return `${layer} ${index}`;
}

function withSingleConnection(value: string) {
  const url = new URL(value); url.searchParams.set("connection_limit", "1"); url.searchParams.set("pool_timeout", "30"); return url.toString();
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
