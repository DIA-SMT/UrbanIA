"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { MapPickCoords } from "@/components/map/urban-leaflet-map";
import { TextField } from "@/components/projects/form/form-ui";

const UrbanLeafletMap = dynamic(() => import("@/components/map/urban-leaflet-map").then((mod) => mod.UrbanLeafletMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[380px] place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-sm font-semibold text-slate-400">
      Cargando mapa...
    </div>
  )
});

export function LocationBlock({
  addressLabel,
  coords,
  onAddressChange,
  onCoordsChange,
  onDistrictChange
}: {
  addressLabel: string;
  coords: MapPickCoords | null;
  onAddressChange: (value: string) => void;
  onCoordsChange: (coords: MapPickCoords) => void;
  onDistrictChange: (districtId: string | null) => void;
}) {
  const [district, setDistrict] = useState<{ id: string; code: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!coords) {
      setDistrict(null);
      onDistrictChange(null);
      return;
    }
    let active = true;
    fetch(`/api/districts/contains?lat=${coords.lat}&lng=${coords.lng}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const detected = payload.district ?? null;
        setDistrict(detected);
        onDistrictChange(detected?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  return (
    <div className="grid gap-3">
      <TextField label="Direccion o referencia" value={addressLabel} onChange={onAddressChange} placeholder="Ej. Avenida Aconquija entre El Corte y Camino de Sirga" />

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <UrbanLeafletMap mode="pick" value={coords} onPick={onCoordsChange} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {coords ? (
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#1f89f6]" />{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
        ) : (
          <span className="text-slate-500">Hace clic en el mapa para ubicar el proyecto (opcional).</span>
        )}
        {district ? (
          <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[11px] font-bold text-emerald-100">
            Distrito detectado: {district.code}{district.name ? ` — ${district.name}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
