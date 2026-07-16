"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MunicipalArea, ProjectStage, ProjectStatus } from "@prisma/client";
import { Anchor, FolderKanban, Layers, Link2, MapPin, Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  feasibilityLabels,
  feasibilityStyles,
  formatCurrency,
  municipalAreaLabels,
  projectStageLabels,
  projectStatusLabels,
  projectStatusStyles,
  type ProjectListItem
} from "@/lib/projects/shared";

type StatusFilter = ProjectStatus | "ALL";
type StageFilter = ProjectStage | "ALL";
type AreaFilter = MunicipalArea | "ALL";

export function ProjectsBoard({
  projects,
  isLive,
  canCreate
}: {
  projects: ProjectListItem[];
  isLive: boolean;
  canCreate: boolean;
}) {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [stage, setStage] = useState<StageFilter>("ALL");
  const [area, setArea] = useState<AreaFilter>("ALL");

  const visible = useMemo(
    () =>
      projects.filter(
        (project) =>
          (status === "ALL" || project.status === status) &&
          (stage === "ALL" || project.stage === stage) &&
          (area === "ALL" || project.areas.includes(area))
      ),
    [projects, status, stage, area]
  );

  const metrics = useMemo(
    () => ({
      total: projects.length,
      inReview: projects.filter((project) => project.status === "IN_REVIEW").length,
      inProgress: projects.filter((project) => project.status === "IN_PROGRESS").length,
      completed: projects.filter((project) => project.status === "COMPLETED").length
    }),
    [projects]
  );

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
                <FolderKanban className="h-4 w-4" />
                Cartera de proyectos
              </div>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-4xl">Proyectos urbanos</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Formulacion, diagnostico tecnico con normativa anclada, presupuesto y trazabilidad hasta gabinete.
              </p>
            </div>
            {canCreate ? (
              <Link href="/proyectos/nuevo" className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
                <Plus className="h-4 w-4" />
                Crear proyecto
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total" value={metrics.total.toString()} />
            <Metric label="En revision" value={metrics.inReview.toString()} />
            <Metric label="En ejecucion" value={metrics.inProgress.toString()} />
            <Metric label="Finalizados" value={metrics.completed.toString()} />
          </div>
        </div>
      </section>

      <section className="urban-card rounded-lg p-4 lg:p-5">
        <FilterRow label="Estado">
          <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")}>Todos</FilterChip>
          {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((value) => (
            <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
              {projectStatusLabels[value]}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Etapa">
          <FilterChip active={stage === "ALL"} onClick={() => setStage("ALL")}>Todas</FilterChip>
          {(Object.keys(projectStageLabels) as ProjectStage[]).map((value) => (
            <FilterChip key={value} active={stage === value} onClick={() => setStage(value)}>
              {projectStageLabels[value]}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Area" last>
          <FilterChip active={area === "ALL"} onClick={() => setArea("ALL")}>Todas</FilterChip>
          {(Object.keys(municipalAreaLabels) as MunicipalArea[]).map((value) => (
            <FilterChip key={value} active={area === value} onClick={() => setArea(value)}>
              {municipalAreaLabels[value]}
            </FilterChip>
          ))}
        </FilterRow>
      </section>

      <section className="urban-card rounded-lg p-4 lg:p-5">
        {visible.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title={projects.length ? "Ningun proyecto coincide con los filtros" : "Todavia no hay proyectos"}
            description={
              projects.length
                ? "Ajusta o limpia los filtros para ver la cartera completa."
                : isLive
                  ? "Crea el primer proyecto o aproba un aporte ciudadano desde Participacion."
                  : "No pudimos conectar con la base de datos para listar los proyectos."
            }
            action={
              canCreate && !projects.length ? (
                <Link href="/proyectos/nuevo" className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white">
                  <Plus className="h-4 w-4" />
                  Crear proyecto
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link href={`/proyectos/${project.id}`} className="urban-lift block rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-slate-400">{project.code}</span>
        {project.latestFeasibility ? (
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${feasibilityStyles[project.latestFeasibility]}`}>
            Factibilidad {feasibilityLabels[project.latestFeasibility].toLowerCase()}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${projectStatusStyles[project.status]}`}>{projectStatusLabels[project.status]}</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">
          <Layers className="h-3 w-3" />
          {projectStageLabels[project.stage]}
        </span>
      </div>
      <h3 className="mt-3 text-base font-black leading-6 text-white">{project.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{project.summary}</p>
      {project.areas.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.areas.slice(0, 4).map((areaCode) => (
            <span key={areaCode} className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">{municipalAreaLabels[areaCode]}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-[#1f89f6]" />{formatCurrency(project.budgetTotal)}</span>
        <span className="inline-flex items-center gap-1.5"><Anchor className="h-3.5 w-3.5 text-[#1f89f6]" />{project.anchorCount} anclados</span>
        {project.addressLabel ? (
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#1f89f6]" /><span className="truncate">{project.addressLabel}</span></span>
        ) : null}
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function FilterRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${last ? "" : "mb-3 border-b border-white/8 pb-3"}`}>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Link2 className="h-3 w-3" />
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
        active ? "bg-civic-blue text-white" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
