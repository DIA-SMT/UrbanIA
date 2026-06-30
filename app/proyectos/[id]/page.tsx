import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, ClipboardList, FileText, MapPin, MessageSquare, ShieldAlert, Sparkles, ThumbsUp } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getUrbanProject, urbanProjects } from "@/lib/demo/urban-projects";

export function generateStaticParams() {
  return urbanProjects.map((project) => ({ id: project.id }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getUrbanProject(id);

  if (!project) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/propuestas" className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Volver a propuestas
        </Link>
      </div>

      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-sky-200">
              <FileText className="h-4 w-4" />
              Ficha de proyecto
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">{project.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{project.objective}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-md bg-sky-400/15 px-3 py-2 text-xs font-bold text-sky-200">{project.status}</span>
              <span className="rounded-md bg-cyan-400/15 px-3 py-2 text-xs font-bold text-cyan-100">{project.layer}</span>
              <span className="rounded-md bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-300">{project.neighborhood}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Apoyos", project.votes.toString(), ThumbsUp],
              ["Comentarios", project.comments.toString(), MessageSquare],
              ["Plazo", project.timeline, Clock3]
            ].map(([label, value, Icon]) => (
              <div key={label as string} className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center gap-2 text-civic-sky">
                  <Icon className="h-4 w-4" />
                  <p className="text-xl font-black">{value as string}</p>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoPanel title="Impactos esperados" icon={BarChart3} items={project.impact} tone="sky" />
          <InfoPanel title="Riesgos a gestionar" icon={ShieldAlert} items={project.risks} tone="amber" />
          <div className="urban-card urban-lift rounded-lg p-5 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <FileText className="h-5 w-5 text-civic-sky" />
              Revision normativa y tecnica
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <FactBlock label="Relacion CPU" value={project.codeRelation ?? "Pendiente de carga normativa"} />
              <FactBlock label="Estado de revision" value={project.reviewStatus ?? project.status} />
              <div className="lg:col-span-2">
                <FactBlock label="Justificacion tecnica" value={project.technicalJustification ?? project.objective} />
              </div>
            </div>
          </div>
          <div className="urban-card urban-lift rounded-lg p-5 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <CheckCircle2 className="h-5 w-5 text-sky-300" />
              Proximos pasos
            </h2>
            <div className="grid gap-3 md:grid-cols-4">
              {project.nextSteps.map((step, index) => (
                <div key={step} className="rounded-md border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs font-black text-sky-300">0{index + 1}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="urban-card urban-lift rounded-lg p-5">
            <h2 className="mb-4 text-lg font-black text-white">Datos operativos</h2>
            {[
              ["Area responsable", project.responsible],
              ["Presupuesto", project.budget],
              ["Ubicacion", project.position.join(", ")],
              ["Origen", project.author]
            ].map(([label, value]) => (
              <div key={label} className="mb-3 rounded-md border border-white/8 bg-white/[0.03] p-3 last:mb-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          <div className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <MapPin className="h-5 w-5 text-cyan-300" />
              Trazabilidad
            </h2>
            <div className="grid gap-3">
              {project.linkedMeetingId ? <TraceLink href="/gabinete" label="Acta de gabinete" icon={ClipboardList} /> : null}
              {project.linkedHearingId ? <TraceLink href="/audiencias" label="Audiencia vinculada" icon={CalendarDays} /> : null}
              <TraceLink href={`/escenarios/${project.id}`} label="Escenario de decision" icon={Sparkles} primary />
              <TraceLink href="/mapa" label="Ver en mapa operativo" icon={MapPin} />
              <TraceLink href="/asistente" label="Consultar al asistente IA" icon={MessageSquare} />
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function TraceLink({ href, label, icon: Icon, primary }: { href: string; label: string; icon: typeof ArrowRight; primary?: boolean }) {
  return (
    <Link href={href} className={`urban-button inline-flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-black ${primary ? "bg-civic-blue text-white" : "border border-white/10 bg-white/[0.04] text-slate-200"}`}>
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function FactBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function InfoPanel({ title, icon: Icon, items, tone }: { title: string; icon: typeof BarChart3; items: string[]; tone: "sky" | "amber" }) {
  const iconColor = tone === "sky" ? "text-sky-300" : "text-amber-300";

  return (
    <div className="urban-card urban-lift rounded-lg p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

