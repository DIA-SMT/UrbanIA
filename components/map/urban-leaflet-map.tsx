"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { Bike, Building2, CheckCircle2, Layers3, MapPin, Search, SlidersHorizontal, Trees, X } from "lucide-react";
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
  const [query, setQuery] = useState("");

  const visibleProjects = useMemo(
    () => urbanProjects.filter((project) => activeLayers.includes(project.layer) && `${project.title} ${project.neighborhood} ${project.responsible}`.toLowerCase().includes(query.toLowerCase())),
    [activeLayers, query]
  );

  function toggleLayer(layer: ProjectLayer) {
    setActiveLayers((current) =>
      current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer]
    );
  }

  return (
    <section className="surface-panel relative overflow-hidden">
        <div className="relative h-[620px] md:h-[calc(100vh-190px)] md:min-h-[660px]">
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

          <aside className="absolute left-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-[300px] rounded-2xl border border-white/70 bg-white/92 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1b2a]/92 md:left-4 md:top-4">
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#1f89f6]" /><h2 className="text-sm font-black text-slate-950 dark:text-white">Explorar territorio</h2><span className="ml-auto rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">{visibleProjects.length}</span></div>
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar zona o proyecto" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Capas</p><div className="mt-2 space-y-1">{layers.map((layer) => {
              const isActive = activeLayers.includes(layer);
              const Icon = layerStyles[layer].icon;

              return (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition ${
                    isActive ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {layer}
                  <span className={`ml-auto h-2 w-2 rounded-full ${isActive ? "bg-[#1f89f6]" : "bg-slate-200 dark:bg-slate-700"}`} />
                </button>
              );
            })}</div>
          </aside>

          <div className="absolute bottom-4 left-4 z-[500] hidden rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-500 shadow backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/90 md:block"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#1f89f6]" />Proyecto urbano · OpenStreetMap</div>

          <aside className="absolute bottom-3 right-3 z-[500] max-h-[52%] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-white/70 bg-white/94 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1b2a]/94 md:bottom-auto md:right-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[320px] md:p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="eyebrow">Contexto territorial</p><h2 className="mt-1 font-black text-slate-950 dark:text-white">{selectedProject?.neighborhood ?? "Seleccionar territorio"}</h2></div>{selectedProject && <button onClick={() => setSelectedProject(null)} className="icon-button h-8 w-8"><X className="h-4 w-4" /></button>}</div>
            {selectedProject ? <div><span className="rounded-full px-2.5 py-1 text-[10px] font-black text-white" style={{ backgroundColor: layerStyles[selectedProject.layer].color }}>{selectedProject.layer}</span><h3 className="mt-4 text-lg font-black leading-tight text-slate-950 dark:text-white">{selectedProject.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedProject.description}</p><div className="mt-4 grid grid-cols-2 gap-2">{[["Estado", selectedProject.status], ["Aportes", selectedProject.votes], ["Comentarios", selectedProject.comments], ["Alertas", selectedProject.risks.length]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]"><strong className="block text-sm text-slate-950 dark:text-white">{value}</strong><span className="text-[10px] text-slate-400">{label}</span></div>)}</div><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Actividad reciente</p><div className="mt-2 space-y-2 text-xs text-slate-500 dark:text-slate-400"><p>• Revisión técnica actualizada</p>{selectedProject.linkedHearingId && <p>• Audiencia pública vinculada</p>}<p>• {selectedProject.risks.length} riesgos identificados</p></div><Link href={`/proyectos/${selectedProject.id}`} className="primary-button mt-5 flex w-full"><CheckCircle2 className="h-4 w-4" />Abrir contexto territorial</Link></div> : <div className="py-8 text-center text-sm text-slate-400"><MapPin className="mx-auto mb-3 h-7 w-7" />Seleccioná un punto del mapa.</div>}
          </aside>
        </div>
      <aside className="hidden">
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
                <span className="text-xs font-semibold text-sky-300">{selectedProject.status}</span>
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

            <Link href={`/proyectos/${selectedProject.id}`} className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
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
