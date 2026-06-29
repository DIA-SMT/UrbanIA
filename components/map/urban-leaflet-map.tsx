"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { Bike, Building2, CheckCircle2, Layers3, MapPin, Trees, X } from "lucide-react";
import { urbanProjects, type ProjectLayer, type UrbanProject } from "@/lib/demo/urban-projects";

const tucumanCenter: [number, number] = [-26.8241, -65.2226];
const layers: ProjectLayer[] = ["Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"];

const layerStyles: Record<ProjectLayer, { color: string; icon: typeof Bike }> = {
  Transporte: { color: "#38bdf8", icon: Bike },
  "Espacios verdes": { color: "#34d399", icon: Trees },
  Equipamiento: { color: "#f59e0b", icon: Building2 },
  Zonificacion: { color: "#a78bfa", icon: Layers3 },
  Riesgos: { color: "#fb7185", icon: MapPin }
};

const studyArea: [number, number][] = [
  [-26.838, -65.246],
  [-26.804, -65.232],
  [-26.812, -65.188],
  [-26.849, -65.198]
];

export function UrbanLeafletMap() {
  const [activeLayers, setActiveLayers] = useState<ProjectLayer[]>(["Transporte", "Espacios verdes", "Equipamiento"]);
  const [selectedProject, setSelectedProject] = useState<UrbanProject | null>(urbanProjects[0]);

  const visibleProjects = useMemo(
    () => urbanProjects.filter((project) => activeLayers.includes(project.layer)),
    [activeLayers]
  );

  function toggleLayer(layer: ProjectLayer) {
    setActiveLayers((current) =>
      current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer]
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="urban-card overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <h1 className="text-xl font-black text-white">Mapa operativo de San Miguel de Tucuman</h1>
            <p className="mt-1 text-sm text-slate-400">Prueba funcional con OpenStreetMap, capas y proyectos demo.</p>
          </div>
          <div className="rounded-md bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-200">
            {visibleProjects.length} proyectos visibles
          </div>
        </div>

        <div className="relative h-[620px]">
          <MapContainer center={tucumanCenter} zoom={13} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polygon positions={studyArea} pathOptions={{ color: "#42d392", weight: 2, fillOpacity: 0.08 }} />
            <MapFocus project={selectedProject} />
            {visibleProjects.map((project) => (
              <ProjectMarker key={project.id} project={project} onSelect={setSelectedProject} />
            ))}
          </MapContainer>

          <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-2 rounded-md border border-white/10 bg-slate-950/80 p-2 backdrop-blur">
            {layers.map((layer) => {
              const isActive = activeLayers.includes(layer);
              const Icon = layerStyles[layer].icon;

              return (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  className={`urban-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${
                    isActive ? "bg-emerald-400/18 text-emerald-100" : "bg-white/7 text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {layer}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="urban-card rounded-lg p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Detalle territorial</h2>
            <p className="text-sm text-slate-500">Click en un punto del mapa</p>
          </div>
          {selectedProject ? (
            <button onClick={() => setSelectedProject(null)} className="urban-button rounded-md border border-white/10 p-2 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {selectedProject ? (
          <div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-md px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: layerStyles[selectedProject.layer].color }}>
                  {selectedProject.layer}
                </span>
                <span className="text-xs font-semibold text-emerald-300">{selectedProject.status}</span>
              </div>
              <h3 className="text-xl font-black leading-tight text-white">{selectedProject.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{selectedProject.description}</p>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ["Area responsable", selectedProject.responsible],
                ["Estado", selectedProject.status],
                ["Ubicacion", selectedProject.position.join(", ")]
              ].map(([label, value]) => (
                <div key={label} className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
                </div>
              ))}
            </div>

            <Link href={`/proyectos/${selectedProject.id}`} className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-civic-ink">
              <CheckCircle2 className="h-4 w-4" />
              Abrir ficha del proyecto
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 p-5 text-sm leading-6 text-slate-400">
            Selecciona un proyecto para ver estado, area responsable, descripcion e indicadores asociados.
          </div>
        )}
      </aside>
    </section>
  );
}

function ProjectMarker({ project, onSelect }: { project: UrbanProject; onSelect: (project: UrbanProject) => void }) {
  const icon = useMemo(() => {
    const style = layerStyles[project.layer];

    return L.divIcon({
      className: "",
      html: `<div style="width:34px;height:34px;border-radius:999px;background:${style.color};border:3px solid rgba(255,255,255,.9);box-shadow:0 12px 28px rgba(0,0,0,.35);"></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }, [project.layer]);

  return (
    <>
      <CircleMarker
        center={project.position}
        radius={22}
        pathOptions={{ color: layerStyles[project.layer].color, fillColor: layerStyles[project.layer].color, fillOpacity: 0.14, weight: 1 }}
      />
      <Marker position={project.position} icon={icon} eventHandlers={{ click: () => onSelect(project) }}>
        <Popup>
          <strong>{project.title}</strong>
          <br />
          {project.status}
        </Popup>
      </Marker>
    </>
  );
}

function MapFocus({ project }: { project: UrbanProject | null }) {
  const map = useMap();

  useEffect(() => {
    if (project) {
      map.flyTo(project.position, 14, { duration: 0.8 });
    }
  }, [map, project]);

  return null;
}
