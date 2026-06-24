"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/shell";

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

export function UrbanMapShell() {
  return (
    <AppShell>
      <UrbanLeafletMap />
    </AppShell>
  );
}
