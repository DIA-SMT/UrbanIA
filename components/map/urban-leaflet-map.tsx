"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import { Check, Filter, Layers3, MapPin, Search, X } from "lucide-react";

const center: [number, number] = [-26.8241, -65.2226];
const colors = ["#1f89f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];
type GeometryFilter = "all" | "point" | "line" | "polygon";
type RemoteLayer = { id: string; name: string; slug: string; visibleByDefault: boolean; featureCount: number };

export function UrbanLeafletMap() {
  const [layers, setLayers] = useState<RemoteLayer[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [data, setData] = useState<FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [query, setQuery] = useState("");
  const [geometry, setGeometry] = useState<GeometryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<{ layer: string; properties: Record<string, unknown> } | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/map/layers").then((response) => response.ok ? response.json() : Promise.reject()).then((items: RemoteLayer[]) => { setLayers(items); setActive([]); }).catch(() => setError("No se pudieron cargar las capas desde Supabase."));
  }, []);

  const loadViewport = useCallback(async (bounds: L.LatLngBounds, zoom: number) => {
    requestRef.current?.abort();
    if (!active.length) { setData({ type: "FeatureCollection", features: [] }); setIsLoading(false); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(",");
    setIsLoading(true);
    try {
      const response = await fetch(`/api/map/features?layers=${encodeURIComponent(active.join(","))}&bbox=${bbox}&zoom=${zoom}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const collection = await response.json() as FeatureCollection;
      startTransition(() => setData(collection));
      setError("");
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError("No se pudieron consultar las geometrías visibles.");
    } finally {
      if (requestRef.current === controller) setIsLoading(false);
    }
  }, [active]);

  useEffect(() => () => requestRef.current?.abort(), []);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const searchIndex = useMemo(() => data.features.map((feature) => JSON.stringify(feature.properties ?? {}).toLowerCase()), [data]);
  const filtered = useMemo(() => ({ ...data, features: data.features.filter((feature, index) => matchesGeometry(feature.geometry, geometry) && (!deferredQuery || searchIndex[index].includes(deferredQuery))) }), [data, searchIndex, geometry, deferredQuery]);

  return <section className="relative isolate h-[calc(100vh-190px)] min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-white/10 dark:bg-[#071724]">
    <MapContainer center={center} zoom={13} minZoom={10} scrollWheelZoom preferCanvas className="h-full w-full" zoomControl={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON key={`${active.join("-")}-${filtered.features.length}-${deferredQuery}-${geometry}`} data={filtered} style={(feature) => { const color = colorFor(String(feature?.properties?._layerSlug ?? ""), layers); return { color, weight: 2, fillColor: color, fillOpacity: 0.2 }; }} pointToLayer={(feature, latlng) => { const color = colorFor(String(feature.properties?._layerSlug ?? ""), layers); return L.circleMarker(latlng, { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }); }} onEachFeature={(feature, leafletLayer) => leafletLayer.on("click", () => setSelected({ layer: String(feature.properties?._layer ?? "Capa territorial"), properties: (feature.properties ?? {}) as Record<string, unknown> }))} />
      <ViewportLoader activeKey={active.join(",")} onChange={loadViewport} />
    </MapContainer>

    <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-2"><div className="rounded-xl border border-white/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/95"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Estado del mapa</p><div className="mt-1 flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-200"><span>{layers.length} capas</span><span className="h-3 w-px bg-slate-200 dark:bg-white/10" /><span>{filtered.features.length} visibles</span></div></div><button onClick={() => setFiltersOpen((value) => !value)} className="flex h-12 items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/95 dark:text-white"><Filter className="h-4 w-4 text-[#1f89f6]" />Filtros</button></div>

    {filtersOpen && <aside className="absolute left-4 top-20 z-[500] max-h-[calc(100%-6rem)] w-[min(330px,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/95"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-[#1f89f6]" /><h2 className="text-sm font-black text-slate-950 dark:text-white">Capas y filtros</h2></div><button onClick={() => setFiltersOpen(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div><label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar calle, escuela, padrón..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Geometría</p><div className="mt-2 flex flex-wrap gap-1">{(["all", "point", "line", "polygon"] as const).map((value) => <button key={value} onClick={() => setGeometry(value)} className={`rounded-lg px-2.5 py-2 text-xs font-bold ${geometry === value ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200" : "text-slate-500"}`}>{value === "all" ? "Todas" : value === "point" ? "Puntos" : value === "line" ? "Líneas" : "Polígonos"}</button>)}</div><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Capas Supabase</p><div className="mt-2 space-y-1">{layers.map((layer, index) => { const enabled = active.includes(layer.slug); return <button key={layer.id} onClick={() => setActive((current) => enabled ? current.filter((slug) => slug !== layer.slug) : [...current, layer.slug])} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="min-w-0 flex-1 truncate">{layer.name}</span><span className="text-[10px] text-slate-400">{layer.featureCount.toLocaleString("es-AR")}</span>{enabled && <Check className="h-4 w-4 text-[#1f89f6]" />}</button>; })}</div></aside>}

    {selected && <aside className="absolute bottom-4 right-4 z-[500] max-h-[calc(100%-2rem)] w-[min(400px,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/95 md:bottom-auto md:top-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f89f6]">Elemento territorial</p><h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{selected.layer}</h2></div><button onClick={() => setSelected(null)} className="text-slate-400"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-2">{Object.entries(selected.properties).filter(([key]) => !key.startsWith("_")).slice(0, 24).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{key}</p><p className="mt-1 break-words text-sm text-slate-700 dark:text-slate-200">{formatValue(value)}</p></div>)}</div></aside>}
    {isLoading && <div className="pointer-events-none absolute right-4 top-4 z-[450] rounded-lg bg-slate-950/75 px-3 py-2 text-xs font-bold text-white shadow backdrop-blur">Actualizando mapa…</div>}
    {error && <div className="absolute bottom-4 left-1/2 z-[600] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">{error}</div>}
    {!layers.length && !error && <div className="pointer-events-none absolute bottom-6 left-1/2 z-[400] -translate-x-1/2 rounded-xl border border-white/80 bg-white/90 px-4 py-3 text-xs text-slate-500 shadow backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/90 dark:text-slate-300"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1f89f6]" />Cargando capas territoriales...</span></div>}
  </section>;
}

function ViewportLoader({ activeKey, onChange }: { activeKey: string; onChange: (bounds: L.LatLngBounds, zoom: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const map = useMapEvents({ moveend: () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => onChange(map.getBounds(), map.getZoom()), 180); } });
  useEffect(() => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => onChange(map.getBounds(), map.getZoom()), 0); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [activeKey, map, onChange]);
  return null;
}
function matchesGeometry(geometry: Geometry | null, filter: GeometryFilter) { if (filter === "all") return true; const type = geometry?.type ?? ""; if (filter === "point") return type.includes("Point"); if (filter === "line") return type.includes("LineString"); return type.includes("Polygon"); }
function colorFor(slug: string, layers: RemoteLayer[]) { return colors[Math.max(0, layers.findIndex((layer) => layer.slug === slug)) % colors.length]; }
function formatValue(value: unknown) { if (value == null) return "Sin dato"; return typeof value === "object" ? JSON.stringify(value) : String(value); }
