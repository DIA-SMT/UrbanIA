"use client";

import { useMemo, useState } from "react";
import {
  Bike,
  Building2,
  Bus,
  Layers3,
  MapPin,
  Search,
  Trees,
  Users,
  X
} from "lucide-react";
import { metrics } from "@/lib/data";
import type { DashboardMetric } from "@/lib/dashboard/data";

type MapMode = "2D" | "3D";

type Layer = "Transporte" | "Espacios verdes" | "Equipamiento" | "Zonificacion" | "Riesgos";

const pins = [
  {
    icon: Building2,
    label: "Codigo urbano",
    layer: "Zonificacion",
    className: "left-[50%] top-[24%] bg-violet-500",
    description: "Articulos del Codigo de Planeamiento, alturas, usos del suelo y reglas de intervencion.",
    status: "3 tematicas vinculadas"
  },
  {
    icon: Trees,
    label: "Espacios verdes",
    layer: "Espacios verdes",
    className: "left-[70%] top-[31%] bg-civic-blue",
    description: "Plazas, parques, arbolado y cobertura ambiental por zona.",
    status: "Capa ambiental activa"
  },
  {
    icon: Bus,
    label: "Transporte",
    layer: "Transporte",
    className: "left-[85%] top-[48%] bg-amber-500",
    description: "Corredores, paradas, nodos de transferencia y movilidad publica.",
    status: "Escenario en preparacion"
  },
  {
    icon: Users,
    label: "Aportes Cidituc",
    layer: "Equipamiento",
    className: "left-[52%] top-[63%] bg-rose-500",
    description: "Aportes ciudadanos importados para lectura territorial y vinculacion con expedientes.",
    status: "128 aportes registrados"
  },
  {
    icon: Bike,
    label: "Movilidad",
    layer: "Transporte",
    className: "left-[79%] top-[70%] bg-sky-500",
    description: "Ciclovias, caminabilidad y alternativas de movilidad activa.",
    status: "Nueva ciclovia destacada"
  }
] satisfies Array<{
  icon: typeof Building2;
  label: string;
  layer: Layer;
  className: string;
  description: string;
  status: string;
}>;

const layers: Layer[] = ["Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"];

export function CityMap({ dashboardMetrics = metrics }: { dashboardMetrics?: DashboardMetric[] }) {
  const [mode, setMode] = useState<MapMode>("3D");
  const [activeLayers, setActiveLayers] = useState<Layer[]>(["Transporte", "Espacios verdes", "Equipamiento", "Zonificacion"]);
  const [query, setQuery] = useState("");
  const [selectedPin, setSelectedPin] = useState<(typeof pins)[number] | null>(pins[0]);

  const visiblePins = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return pins.filter((pin) => {
      const matchesLayer = activeLayers.includes(pin.layer);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        pin.label.toLowerCase().includes(normalizedQuery) ||
        pin.layer.toLowerCase().includes(normalizedQuery) ||
        pin.description.toLowerCase().includes(normalizedQuery);

      return matchesLayer && matchesQuery;
    });
  }, [activeLayers, query]);

  function toggleLayer(layer: Layer) {
    setActiveLayers((current) => {
      if (current.includes(layer)) {
        return current.filter((item) => item !== layer);
      }

      return [...current, layer];
    });
  }

  return (
    <section className="urban-card urban-lift relative min-h-[560px] overflow-hidden rounded-lg md:min-h-[430px]">
      <div
        className={`absolute inset-0 bg-cover bg-center transition duration-500 ${
          mode === "3D"
            ? "scale-105 bg-[linear-gradient(135deg,rgba(11,37,48,0.92),rgba(17,24,39,0.48)),url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80')]"
            : "bg-[linear-gradient(135deg,rgba(5,20,27,0.94),rgba(15,23,42,0.62)),url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80')]"
        }`}
      />
      <div className={`absolute inset-0 map-grid transition ${mode === "3D" ? "opacity-20" : "opacity-40"}`} />
      <div className="relative z-10 grid min-h-[560px] grid-cols-1 md:min-h-[430px] lg:grid-cols-[340px_1fr]">
        <div className="m-4 rounded-lg border border-white/10 bg-slate-950/62 p-5 backdrop-blur md:m-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black leading-tight text-white">San Miguel de Tucuman</h1>
            <span className="text-amber-300">21 C</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Ubica propuestas oficiales, articulos del CPU, audiencias y aportes ciudadanos en el territorio.</p>
          <label className="urban-lift mt-5 flex items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-400">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
              placeholder="Buscar propuestas, CPU, audiencias..."
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="urban-button rounded-md p-1 text-slate-300">
                <X className="h-4 w-4" />
              </button>
            ) : (
              <Search className="h-4 w-4" />
            )}
          </label>
          <div className="mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            {dashboardMetrics.map((metric) => (
              <div key={metric.label} className="urban-lift rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-2xl font-black leading-tight text-civic-sky">{metric.value}</p>
                <p className="mt-2 text-xs leading-4 text-slate-300">{metric.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
            <MapPin className="h-4 w-4" />
            {visiblePins.length} puntos visibles
          </div>
        </div>

        <div className="relative min-h-[260px]">
          <div className="absolute right-5 top-5 z-20 flex gap-2">
            {(["2D", "3D"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`urban-button rounded-md px-3 py-2 text-sm font-semibold ${
                  mode === item ? "bg-cyan-400/20 text-cyan-100" : "bg-slate-950/70 text-slate-300"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => setActiveLayers(layers)}
              className="urban-button rounded-md bg-slate-950/70 p-2 text-slate-200"
              title="Mostrar todas las capas"
            >
              <Layers3 className="h-5 w-5" />
            </button>
          </div>

          {visiblePins.map((pin) => (
            <button
              key={pin.label}
              onClick={() => setSelectedPin(pin)}
              className={`urban-pin absolute grid h-12 w-12 place-items-center rounded-full border-4 text-white shadow-glow md:h-14 md:w-14 ${
                selectedPin?.label === pin.label ? "border-cyan-100 ring-4 ring-cyan-300/25" : "border-white/75"
              } ${pin.className}`}
              aria-label={`Ver ${pin.label}`}
            >
              <pin.icon className="h-6 w-6 md:h-7 md:w-7" />
            </button>
          ))}

          {selectedPin ? (
            <div className="urban-lift absolute bottom-24 right-5 hidden w-72 rounded-lg border border-white/10 bg-slate-950/78 p-4 backdrop-blur lg:block">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{selectedPin.label}</p>
                  <p className="text-xs font-semibold text-sky-300">{selectedPin.layer}</p>
                </div>
                <button onClick={() => setSelectedPin(null)} className="urban-button rounded-md p-1 text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-6 text-slate-300">{selectedPin.description}</p>
              <div className="mt-3 rounded-md bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300">{selectedPin.status}</div>
            </div>
          ) : null}

          <div className="urban-scrollbar absolute bottom-5 left-1/2 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 gap-2 overflow-x-auto rounded-md border border-white/10 bg-slate-950/72 p-2 backdrop-blur sm:flex-wrap sm:justify-center sm:overflow-visible">
            {layers.map((layer) => {
              const isActive = activeLayers.includes(layer);

              return (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  className={`urban-button rounded-md px-3 py-2 text-xs font-semibold ${
                    isActive ? "bg-sky-400/18 text-sky-100" : "bg-white/7 text-slate-400"
                  }`}
                >
                  {layer}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
