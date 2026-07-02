import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  MapPin,
  Plus,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { urbanProjects, type ProjectLayer, type ProjectStatus, type UrbanProject } from "@/lib/demo/urban-projects";

const statusStyles: Record<ProjectStatus, string> = {
  "En analisis": "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Planificado: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  "En ejecucion": "border-sky-300/20 bg-sky-300/10 text-sky-200",
  Realizado: "border-violet-300/20 bg-violet-300/10 text-violet-200"
};

const layerStyles: Record<ProjectLayer, string> = {
  Transporte: "bg-sky-400/15 text-sky-200",
  "Espacios verdes": "bg-emerald-400/15 text-emerald-200",
  Equipamiento: "bg-orange-400/15 text-orange-200",
  Zonificacion: "bg-violet-400/15 text-violet-200",
  Riesgos: "bg-rose-400/15 text-rose-200"
};

export default function ProyectosPage() {
  const activeProjects = urbanProjects.filter((project) => project.status !== "Realizado");
  const linkedToCabinet = urbanProjects.filter((project) => project.linkedMeetingId).length;
  const linkedToHearings = urbanProjects.filter((project) => project.linkedHearingId).length;
  const documentedProjects = urbanProjects.filter((project) => project.attachedDocuments?.length).length;
  const statuses: ProjectStatus[] = ["En analisis", "Planificado", "En ejecucion", "Realizado"];

  return (
    <AppShell>
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <FolderKanban className="h-4 w-4" />
              Cartera urbana
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">Tablero de proyectos urbanos</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Seguimiento operativo de proyectos, expedientes, escenarios, audiencias y actas vinculadas para decidir con trazabilidad.
            </p>
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Metric label="Proyectos" value={urbanProjects.length.toString()} icon={FolderKanban} />
            <Metric label="Activos" value={activeProjects.length.toString()} icon={BarChart3} />
            <Metric label="Con audiencia" value={linkedToHearings.toString()} icon={CalendarDays} />
            <Metric label="Documentados" value={documentedProjects.toString()} icon={FileText} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {statuses.map((status) => (
              <StatusSummary
                key={status}
                status={status}
                count={urbanProjects.filter((project) => project.status === status).length}
              />
            ))}
          </div>

          <section className="urban-card rounded-lg p-4 lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Listado operativo</p>
                <h2 className="mt-1 text-2xl font-black text-white">Cartera priorizada</h2>
              </div>
              <span className="rounded-md bg-sky-400/15 px-3 py-2 text-xs font-black text-sky-200">
                {linkedToCabinet} con acta vinculada
              </span>
            </div>

            <div className="grid gap-3 2xl:hidden">
              {urbanProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            <div className="urban-scrollbar hidden overflow-x-auto 2xl:block">
              <table className="w-full min-w-[880px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-2">Proyecto</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Capa</th>
                    <th className="px-3 py-2">Revision</th>
                    <th className="px-3 py-2">Vinculos</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {urbanProjects.map((project) => (
                    <ProjectRow key={project.id} project={project} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <Sparkles className="h-5 w-5 text-sky-300" />
              Lectura IA de cartera
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              La cartera tiene {activeProjects.length} proyectos activos. Los casos con mayor trazabilidad son ciclovia Aconquija, plaza Barrio Sur y revision de alturas, porque conectan propuesta, acta, escenario y audiencia.
            </p>
            <Link href="/asistente" className="urban-button mt-5 inline-flex w-full items-center justify-between rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
              Consultar cartera
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <ClipboardList className="h-5 w-5 text-civic-sky" />
              Flujo recomendado
            </h2>
            <div className="grid gap-3">
              {["Completar revision normativa", "Validar audiencia o mesa tecnica", "Preparar escenario de decision", "Elevar minuta a gabinete"].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-300/10 text-xs font-black text-sky-200">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function ProjectRow({ project }: { project: UrbanProject }) {
  return (
    <tr className="urban-lift rounded-lg">
      <td className="w-[30%] rounded-l-lg border-y border-l border-white/8 bg-white/[0.03] px-3 py-4">
        <p className="font-black leading-5 text-white">{project.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{project.neighborhood} - {project.responsible}</p>
      </td>
      <td className="border-y border-white/8 bg-white/[0.03] px-3 py-4">
        <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[project.status]}`}>{project.status}</span>
      </td>
      <td className="border-y border-white/8 bg-white/[0.03] px-3 py-4">
        <span className={`rounded-md px-2.5 py-1 text-[11px] font-black ${layerStyles[project.layer]}`}>{project.layer}</span>
      </td>
      <td className="w-[18%] border-y border-white/8 bg-white/[0.03] px-3 py-4">
        <p className="max-w-56 text-xs font-semibold leading-5 text-slate-300">{project.reviewStatus ?? project.status}</p>
      </td>
      <td className="w-[16%] border-y border-white/8 bg-white/[0.03] px-3 py-4">
        <div className="flex flex-wrap gap-2">
          {project.linkedMeetingId ? <TracePill label="Acta" /> : null}
          {project.linkedHearingId ? <TracePill label="Audiencia" /> : null}
          {project.attachedDocuments?.length ? <TracePill label={`${project.attachedDocuments.length} docs`} /> : null}
        </div>
      </td>
      <td className="rounded-r-lg border-y border-r border-white/8 bg-white/[0.03] px-3 py-4">
        <div className="flex justify-end gap-2">
          <Link href={`/proyectos/${project.id}`} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200">
            Ficha
          </Link>
          <Link href={`/escenarios/${project.id}`} className="urban-button rounded-md bg-civic-blue px-3 py-2 text-xs font-black text-white">
            Escenario
          </Link>
        </div>
      </td>
    </tr>
  );
}

function ProjectCard({ project }: { project: UrbanProject }) {
  return (
    <article className="urban-lift rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-6 text-white">{project.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{project.neighborhood} - {project.responsible}</p>
        </div>
        <span className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[project.status]}`}>
          {project.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/8 bg-slate-950/35 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Capa</p>
          <span className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-[11px] font-black ${layerStyles[project.layer]}`}>
            {project.layer}
          </span>
        </div>
        <div className="rounded-md border border-white/8 bg-slate-950/35 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Revision</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{project.reviewStatus ?? project.status}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {project.linkedMeetingId ? <TracePill label="Acta" /> : null}
        {project.linkedHearingId ? <TracePill label="Audiencia" /> : null}
        {project.attachedDocuments?.length ? <TracePill label={`${project.attachedDocuments.length} docs`} /> : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href={`/proyectos/${project.id}`} className="urban-button inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-slate-200">
          Ficha
        </Link>
        <Link href={`/escenarios/${project.id}`} className="urban-button inline-flex items-center justify-center rounded-md bg-civic-blue px-3 py-2.5 text-xs font-black text-white">
          Escenario
        </Link>
      </div>
    </article>
  );
}

function TracePill({ label }: { label: string }) {
  return <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-[11px] font-black text-sky-100">{label}</span>;
}

function StatusSummary({ status, count }: { status: ProjectStatus; count: number }) {
  return (
    <div className="urban-card urban-lift rounded-lg p-4">
      <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[status]}`}>{status}</span>
      <p className="mt-4 text-3xl font-black text-white">{count}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">proyectos</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FolderKanban }) {
  return (
    <div className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
      <Icon className="h-5 w-5 text-civic-sky" />
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}
