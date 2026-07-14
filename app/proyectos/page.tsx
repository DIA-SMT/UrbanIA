import Link from "next/link";
import type { ProposalStatus } from "@prisma/client";
import { ArrowRight, CalendarDays, ClipboardList, FolderKanban, MapPin, MessageSquare, Plus, ThumbsUp } from "lucide-react";
import { AppShell } from "@/components/shell";
import { listProjectProposals } from "@/lib/proposals/data";
import { proposalSourceLabels, proposalStatusLabels, type ProposalListItem } from "@/lib/proposals/shared";

export const dynamic = "force-dynamic";

const statusStyles: Partial<Record<ProposalStatus, string>> = {
  APPROVED: "border-sky-300/20 bg-sky-300/10 text-sky-200",
  IN_PROGRESS: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  COMPLETED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
};

async function loadProjects(): Promise<{ projects: ProposalListItem[]; isLive: boolean }> {
  if (!process.env.DATABASE_URL) {
    return { projects: [], isLive: false };
  }

  try {
    return { projects: await listProjectProposals(), isLive: true };
  } catch (error) {
    console.error("Unable to load project proposals.", error);
    return { projects: [], isLive: false };
  }
}

export default async function ProyectosPage() {
  const { projects, isLive } = await loadProjects();
  const inProgress = projects.filter((project) => project.status === "IN_PROGRESS").length;
  const approved = projects.filter((project) => project.status === "APPROVED").length;
  const completed = projects.filter((project) => project.status === "COMPLETED").length;

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="urban-card urban-lift overflow-hidden rounded-lg">
          <div className="p-5 lg:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <FolderKanban className="h-4 w-4" />
              Cartera urbana
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">Proyectos urbanos</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Propuestas que avanzaron en el flujo municipal: aprobadas, en ejecucion o finalizadas. Cada proyecto conserva su origen y trazabilidad.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
              <Metric label="Aprobados" value={approved.toString()} />
              <Metric label="En ejecucion" value={inProgress.toString()} />
              <Metric label="Finalizados" value={completed.toString()} />
            </div>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/propuestas" className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white sm:w-auto">
                <Plus className="h-4 w-4" />
                Nueva propuesta
              </Link>
              <Link href="/mapa" className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200 sm:w-auto">
                <MapPin className="h-4 w-4" />
                Ver mapa
              </Link>
            </div>
          </div>
        </section>

        <section className="urban-card rounded-lg p-4 lg:p-5">
          {projects.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-10 text-center">
              <ClipboardList className="mx-auto h-7 w-7 text-slate-500" />
              <h2 className="mt-4 text-lg font-black text-white">Todavia no hay proyectos</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                {isLive
                  ? "Un proyecto aparece aca cuando una propuesta es aprobada por el equipo municipal. Registra propuestas y avanza su revision para verlas en esta cartera."
                  : "No pudimos conectar con la base de datos para listar los proyectos."}
              </p>
              <Link href="/propuestas" className="urban-button mt-6 inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
                Ir a propuestas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ProjectCard({ project }: { project: ProposalListItem }) {
  return (
    <article className="urban-lift rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusStyles[project.status] ?? "border-white/10 bg-white/[0.05] text-slate-300"}`}>
          {proposalStatusLabels[project.status]}
        </span>
        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">{proposalSourceLabels[project.source]}</span>
      </div>
      <h3 className="text-base font-black leading-6 text-white">{project.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{project.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(project.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5" />
          {project.votes}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {project.comments}
        </span>
      </div>
      <Link
        href={`/proyectos/${project.id}`}
        className="urban-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-3 py-2.5 text-xs font-black text-white"
      >
        Abrir ficha
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
