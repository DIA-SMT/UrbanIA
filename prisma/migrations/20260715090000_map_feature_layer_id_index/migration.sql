-- Index the MapFeature -> UrbanLayer foreign key used by the map features API join
CREATE INDEX IF NOT EXISTS "MapFeature_layerId_idx" ON "MapFeature" ("layerId");
