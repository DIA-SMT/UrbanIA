import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Layers3,
  MapPin,
  MessageSquare,
  Scale,
  ShieldAlert,
  Sparkles,
  Users
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { getUrbanProject } from "@/lib/demo/urban-projects";
import { getUrbanScenario, urbanScenarios, type ScenarioDecisionCriterion } from "@/lib/demo/urban-scenarios";

export function generateStaticParams() {
  return urbanScenarios.map((scenario) => ({ id: scenario.id }));
}

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = getUrbanScenario(id);

  if (!scenario) {
    notFound();
  }

  const project = getUrbanProject(scenario.projectId);

  if (!project) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/propuestas" className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Volver a propuestas
        </Link>
        <div className="flex flex-wrap gap-2">
          {project.linkedHearingId ? (
            <Link href="/audiencias" className="urban-button inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-black text-cyan-100">
              Audiencia vinculada
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <Link href={`/proyectos/${project.id}`} className="urban-button inline-flex items-center gap-2 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sm font-black text-sky-100">
            Abrir ficha del proyecto
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <Sparkles className="h-4 w-4" />
              Escenario de decision
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">{scenario.title}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">{scenario.executiveSummary}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-md bg-sky-400/15 px-3 py-2 text-xs font-black text-sky-200">{project.status}</span>
              <span className="rounded-md bg-cyan-400/15 px-3 py-2 text-xs font-black text-cyan-100">{project.layer}</span>
              <span className="rounded-md bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-300">{project.neighborhood}</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <BarChart3 className="h-4 w-4 text-civic-sky" />
              Matriz rapida
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {scenario.criteria.map((criterion) => (
                <CriterionCard key={criterion.label} criterion={criterion} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Hipotesis de impacto" icon={GitBranch}>
            <p className="text-sm leading-7 text-slate-300">{scenario.hypothesis}</p>
          </Panel>

          <Panel title="Areas involucradas" icon={Users}>
            <div className="flex flex-wrap gap-2">
              {scenario.areas.map((area) => (
                <span key={area} className="rounded-md border border-white/8 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200">{area}</span>
              ))}
            </div>
          </Panel>

          <Panel title="Evidencia disponible" icon={BookOpen}>
            <List items={scenario.evidence} color="sky" />
          </Panel>

          <Panel title="Informacion faltante" icon={ShieldAlert}>
            <List items={scenario.missingInformation} color="amber" />
          </Panel>

          <Panel title="Cruce normativo preliminar" icon={Scale}>
            <List items={scenario.normativeChecks} color="cyan" />
          </Panel>

          <Panel title="Aportes ciudadanos vinculados" icon={MessageSquare}>
            <List items={scenario.citizenInputs} color="sky" />
          </Panel>

          <div className="urban-card rounded-lg p-5 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <Layers3 className="h-5 w-5 text-civic-sky" />
              Alternativas para gabinete
            </h2>
            <div className="grid gap-3 lg:grid-cols-3">
              {scenario.alternatives.map((alternative) => (
                <article key={alternative.title} className="urban-lift rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="text-base font-black leading-6 text-white">{alternative.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{alternative.description}</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <Fact label="Impacto" value={alternative.impact} />
                    <Fact label="Riesgo" value={alternative.risk} />
                    <Fact label="Costo" value={alternative.cost} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <GitBranch className="h-5 w-5 text-civic-sky" />
              Trazabilidad del escenario
            </h2>
            <div className="grid gap-3">
              <TraceLink href={`/proyectos/${project.id}`} label="Ficha del proyecto" icon={FileText} />
              {project.linkedMeetingId ? <TraceLink href="/gabinete" label="Acta de gabinete" icon={ClipboardList} /> : null}
              {project.linkedHearingId ? <TraceLink href="/audiencias" label="Audiencia publica" icon={CalendarDays} /> : null}
              <TraceLink href="/mapa" label="Ubicacion territorial" icon={MapPin} />
            </div>
          </div>

          <div className="urban-card urban-lift rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <ClipboardList className="h-5 w-5 text-sky-300" />
              Checklist de decision
            </h2>
            <List items={scenario.cabinetChecklist} color="sky" />
          </div>

          <div className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <FileText className="h-5 w-5 text-cyan-300" />
              Informe preliminar
            </h2>
            <p className="text-sm leading-7 text-slate-300">{scenario.recommendation}</p>
            <button className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
              <FileText className="h-4 w-4" />
              Generar informe para gabinete
            </button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function CriterionCard({ criterion }: { criterion: ScenarioDecisionCriterion }) {
  const colors: Record<ScenarioDecisionCriterion["tone"], string> = {
    sky: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100"
  };

  return (
    <div className={`rounded-md border p-3 ${colors[criterion.tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-75">{criterion.label}</p>
      <p className="mt-1 text-lg font-black">{criterion.value}</p>
    </div>
  );
}

function TraceLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof FileText }) {
  return (
    <Link href={href} className="urban-button inline-flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4 text-civic-sky" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof GitBranch; children: React.ReactNode }) {
  return (
    <div className="urban-card urban-lift rounded-lg p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
        <Icon className="h-5 w-5 text-civic-sky" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function List({ items, color }: { items: string[]; color: "sky" | "amber" | "cyan" }) {
  const iconColor = color === "sky" ? "text-sky-300" : color === "amber" ? "text-amber-300" : "text-cyan-300";

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
          <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${iconColor}`} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-slate-950/35 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 leading-6 text-slate-300">{value}</p>
    </div>
  );
}
