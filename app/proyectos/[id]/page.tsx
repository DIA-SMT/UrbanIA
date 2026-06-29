import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, FileText, MapPin, MessageSquare, ShieldAlert, ThumbsUp } from "lucide-react";
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
          <InfoPanel title="Impactos esperados" icon={BarChart3} items={project.impact} tone="emerald" />
          <InfoPanel title="Riesgos a gestionar" icon={ShieldAlert} items={project.risks} tone="amber" />
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
              Vinculaciones futuras
            </h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">Normativa relacionada</div>
              <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">Comentarios ciudadanos</div>
              <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">Informe IA de impacto</div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function InfoPanel({ title, icon: Icon, items, tone }: { title: string; icon: typeof BarChart3; items: string[]; tone: "emerald" | "amber" }) {
  const iconColor = tone === "emerald" ? "text-sky-300" : "text-amber-300";

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

