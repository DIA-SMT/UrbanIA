"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  Gauge,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  ThumbsUp
} from "lucide-react";
import { urbanProjects, type ProjectLayer, type ProjectStatus, type UrbanProject } from "@/lib/demo/urban-projects";

const statusOptions: Array<ProjectStatus | "Todas"> = ["Todas", "En analisis", "Planificado", "En ejecucion", "Realizado"];
const layerOptions: Array<ProjectLayer | "Todas"> = ["Todas", "Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"];

const statusStyles: Record<ProjectStatus, string> = {
  "En analisis": "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Planificado: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  "En ejecucion": "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  Realizado: "border-violet-300/20 bg-violet-300/10 text-violet-200"
};

const layerStyles: Record<ProjectLayer, string> = {
  Transporte: "bg-sky-400/15 text-sky-200",
  "Espacios verdes": "bg-emerald-400/15 text-emerald-200",
  Equipamiento: "bg-orange-400/15 text-orange-200",
  Zonificacion: "bg-violet-400/15 text-violet-200",
  Riesgos: "bg-rose-400/15 text-rose-200"
};

export function ProposalsBoard() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "Todas">("Todas");
  const [layer, setLayer] = useState<ProjectLayer | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState(urbanProjects[0]?.id ?? "");

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return urbanProjects.filter((project) => {
      const matchesQuery = normalized
        ? [project.title, project.neighborhood, project.description, project.responsible].some((value) =>
            value.toLowerCase().includes(normalized)
          )
        : true;
      const matchesStatus = status === "Todas" || project.status === status;
      const matchesLayer = layer === "Todas" || project.layer === layer;

      return matchesQuery && matchesStatus && matchesLayer;
    });
  }, [query, status, layer]);

  const selectedProject = filteredProjects.find((project) => project.id === selectedId) ?? filteredProjects[0] ?? urbanProjects[0];
  const activeProjects = urbanProjects.filter((project) => project.status !== "Realizado").length;
  const totalVotes = urbanProjects.reduce((acc, project) => acc + project.votes, 0);
  const totalComments = urbanProjects.reduce((acc, project) => acc + project.comments, 0);

  return (
    <div className="space-y-4">
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Gestion urbana
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">Propuestas urbanas</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Priorizacion de ideas, proyectos del mapa y propuestas ciudadanas para convertirlas en escenarios de analisis.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Activas" value={activeProjects.toString()} icon={Gauge} />
              <MetricCard label="Apoyos" value={totalVotes.toString()} icon={ThumbsUp} />
              <MetricCard label="Comentarios" value={totalComments.toString()} icon={MessageSquare} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Flujo recomendado</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Idea, evaluacion tecnica, consulta ciudadana e informe para gabinete.</p>
              </div>
              <span className="rounded-md bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">MVP</span>
            </div>
            <div className="mt-4 grid gap-2">
              {["Registrar propuesta", "Ubicar en mapa", "Cruzar normativa", "Preparar escenario"].map((step, index) => (
                <div key={step} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-400/15 text-xs font-black text-emerald-200">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-200">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="urban-card rounded-lg p-4 lg:p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por barrio, area o propuesta..."
                className="h-11 w-full rounded-md border border-white/10 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-emerald-300/50"
              />
            </label>
            <SelectFilter value={status} options={statusOptions} onChange={(value) => setStatus(value as ProjectStatus | "Todas")} />
            <SelectFilter value={layer} options={layerOptions} onChange={(value) => setLayer(value as ProjectLayer | "Todas")} />
            <button className="urban-button inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-black text-civic-ink">
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProposalCard key={project.id} project={project} selected={project.id === selectedProject.id} onSelect={() => setSelectedId(project.id)} />
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              No hay propuestas con esos filtros. Proba cambiar la busqueda o la capa urbana.
            </div>
          ) : null}
        </div>

        <ProposalDetail project={selectedProject} />
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Gauge }) {
  return (
    <div className="urban-lift rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-civic-mint">
        <Icon className="h-4 w-4" />
        <p className="text-2xl font-black">{value}</p>
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function SelectFilter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-md border border-white/10 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-emerald-300/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProposalCard({ project, selected, onSelect }: { project: UrbanProject; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`urban-lift group rounded-lg border p-4 text-left transition ${
        selected ? "border-emerald-300/45 bg-emerald-300/10" : "border-white/10 bg-white/[0.03] hover:border-emerald-300/25"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[project.status]}`}>{project.status}</span>
        <span className={`rounded-md px-2.5 py-1 text-[11px] font-black ${layerStyles[project.layer]}`}>{project.layer}</span>
      </div>
      <h3 className="text-base font-black leading-6 text-white group-hover:text-emerald-100">{project.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{project.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {project.neighborhood}
        </span>
        <span className="inline-flex items-center gap-3 text-slate-300">
          <span>{project.votes} apoyos</span>
          <span>{project.comments} com.</span>
        </span>
      </div>
    </button>
  );
}

function ProposalDetail({ project }: { project: UrbanProject }) {
  return (
    <aside className="urban-card rounded-lg p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Detalle seleccionado</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-white">{project.title}</h2>
        </div>
        <span className={`shrink-0 rounded-md border px-3 py-1 text-xs font-black ${statusStyles[project.status]}`}>{project.status}</span>
      </div>

      <p className="text-sm leading-6 text-slate-300">{project.objective}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat label="Apoyos" value={project.votes.toString()} icon={ThumbsUp} />
        <MiniStat label="Comentarios" value={project.comments.toString()} icon={MessageSquare} />
        <MiniStat label="Plazo" value={project.timeline} icon={Clock3} />
        <MiniStat label="Presupuesto" value={project.budget} icon={BarChart3} />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-sm font-black text-white">Proximas acciones</p>
        <div className="space-y-2">
          {project.nextSteps.map((step) => (
            <div key={step} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <button className="urban-button inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-civic-ink">
          <Sparkles className="h-4 w-4" />
          Convertir en escenario
        </button>
        <Link href={`/proyectos/${project.id}`} className="urban-button inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
          Abrir ficha completa
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ThumbsUp }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-civic-mint" />
      <p className="text-sm font-black leading-5 text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}
