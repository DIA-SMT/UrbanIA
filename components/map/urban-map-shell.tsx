"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/shell";
import type { UrbanLeafletMapProps } from "@/components/map/urban-leaflet-map";

const UrbanLeafletMap = dynamic(
  () => import("@/components/map/urban-leaflet-map").then((mod) => mod.UrbanLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="urban-card grid min-h-[620px] place-items-center rounded-lg text-sm font-semibold text-slate-400">
        Cargando mapa urbano...
      </div>
    )
  }
);

export function UrbanMapShell(props: UrbanLeafletMapProps = {}) {
  return (
    <AppShell>
      <div className="mb-5">
        <p className="eyebrow">Territorio y evidencia</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">Mapa territorial</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Herramienta operativa para explorar capas, proyectos y contexto urbano.</p>
      </div>
      <UrbanLeafletMap {...props} />
    </AppShell>
  );
}
