import Link from "next/link";
import { ArrowUpRight, BookOpen, Building2, CalendarDays, CheckCircle2, Circle, Clock3, Database, FileText, GitBranch, Send, Users } from "lucide-react";
import { cityComparison, indicators, proposals, regulations, successCases } from "@/lib/data";
import { cabinetMeetings, cabinetSummary, type CabinetTopicStatus } from "@/lib/demo/cabinet-meetings";
import type {
  DashboardCityComparison,
  DashboardRegulation,
  DashboardSuccessCase
} from "@/lib/dashboard/data";

export function IndicatorsPanel() {
  return (
    <Panel title="Indicadores clave" action="2024">
      <div className="space-y-4">
        {indicators.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-300">{item.label}</span>
            <span className="ml-auto font-semibold text-white">{item.value}</span>
            <span className="text-xs text-sky-300">{item.delta}</span>
          </div>
        ))}
      </div>
      <button className="mt-6 text-sm font-semibold text-sky-300">Ver todos los indicadores</button>
    </Panel>
  );
}

export function CityComparisonPanel({ cities = cityComparison }: { cities?: DashboardCityComparison[] }) {
  const max = Math.max(...cities.map((item) => item.value), 1);
  return (
    <Panel title="Comparador de ciudades" action="Ver todas">
      <div className="mb-4 rounded-md border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-300">Indicador: Areas verdes (m2/hab)</div>
      <div className="space-y-3">
        {cities.map((item) => (
          <div key={item.city} className="grid grid-cols-[minmax(84px,110px)_minmax(80px,1fr)_42px] items-center gap-3 text-sm">
            <span className="text-slate-300">{item.city}</span>
            <div className="h-3 rounded-full bg-slate-800">
              <div className={`urban-meter h-3 rounded-full ${item.city === "Tucuman" ? "bg-sky-400" : "bg-sky-500"}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="text-right text-slate-200">{item.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SuccessCasesPanel({ cases = successCases }: { cases?: DashboardSuccessCase[] }) {
  return (
    <Panel title="Casos de exito destacados" action="Ver todos">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cases.map((item, index) => (
          <article key={item.city} className="urban-lift min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
            <div className={`h-24 ${index === 0 ? "bg-cyan-400/30" : index === 1 ? "bg-amber-400/30" : "bg-sky-400/30"} map-grid`} />
            <div className="p-3">
              <p className="font-bold text-white">{item.city}</p>
              <p className="text-xs text-slate-400">{item.country}</p>
              <p className="mt-2 text-sm text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-400">{item.tag}</p>
              <button className="urban-button mt-3 rounded-md border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100">Ver caso</button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function ProposalSimulatorPanel() {
  return (
    <Panel title="Propuesta oficial en analisis" badge="Concejo">
      <div className="h-32 rounded-md bg-[linear-gradient(135deg,rgba(31,137,246,0.30),rgba(14,165,233,0.20)),url('https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center" />
      <h3 className="mt-4 font-bold text-white">Expte. 1482-CD: revision de alturas en corredor norte</h3>
      <div className="mt-4 space-y-3 text-sm">
        {["Uso del suelo: requiere dictamen", "Alturas: conflicto probable", "Audiencia publica: pendiente", "Aportes Cidituc: 42 vinculados"].map((item) => (
          <div key={item} className="flex items-center justify-between text-slate-300">
            <span>{item}</span>
            <ArrowUpRight className="h-4 w-4 text-sky-300" />
          </div>
        ))}
      </div>
      <Link href="/escenarios/codigo-alturas" className="urban-button mt-5 inline-flex w-full items-center justify-center rounded-md bg-civic-blue px-4 py-3 text-sm font-bold text-white">Abrir trazabilidad</Link>
    </Panel>
  );
}

export function AssistantPanel() {
  return (
    <Panel title="Analisis IA" badge="IA">
      <div className="rounded-md border border-white/10 bg-slate-950/60 p-4">
        <p className="font-semibold text-white">Vinculacion normativa</p>
        <p className="mt-1 text-sm text-slate-400">Cruza propuestas, CPU, audiencias y aportes ciudadanos.</p>
      </div>
      <div className="mt-3 space-y-2">
        {["Que articulos del CPU aplican a este expediente?", "Resumir objeciones de la audiencia publica", "Vincular aportes Cidituc por barrio", "Detectar riesgos normativos de la propuesta"].map((prompt) => (
          <button key={prompt} className="urban-lift w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.06]">{prompt}</button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-500">
        <span className="flex-1">Escribi tu consulta...</span>
        <Send className="h-4 w-4 text-slate-300" />
      </div>
    </Panel>
  );
}

export function CitizenActivityPanel() {
  return (
    <Panel title="Aportes desde Cidituc" action="Ver todo">
      <div className="space-y-3">
        {proposals.map((item) => (
          <div key={item.title} className="flex items-center gap-3 border-b border-white/6 pb-3 last:border-0">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700 text-xs">{item.author.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-500">{item.author}</p>
            </div>
            <span className="text-xs text-slate-400">{item.votes}</span>
          </div>
        ))}
      </div>
      <button className="urban-button mt-4 w-full rounded-md border border-sky-300/40 py-2 text-sm font-semibold text-sky-200">Visualizar integracion</button>
    </Panel>
  );
}

export function RegulationsPanel({ items = regulations }: { items?: DashboardRegulation[] }) {
  return (
    <Panel title="Codigo de Planeamiento Urbano" action="Ver CPU">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.number} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
            <FileText className="h-5 w-5 text-sky-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">{item.number}</p>
              <p className="text-xs text-slate-500">{item.title}</p>
            </div>
            <button className="urban-button rounded-md bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200">Ver</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DataSourcesPanel() {
  return (
    <Panel title="Fuentes institucionales" action="Ver todas">
      {["Concejo Deliberante", "Codigo de Planeamiento Urbano", "Cidituc", "Actas de audiencias publicas", "Secretaria de Planeamiento"].map((item) => (
        <div key={item} className="urban-lift mb-3 flex items-center gap-3 rounded-md px-2 py-1 text-sm text-slate-300">
          <Database className="h-5 w-5 text-sky-300" />
          {item}
        </div>
      ))}
    </Panel>
  );
}

export function CabinetPanel() {
  return (
    <Panel title="Registro de gabinete y audiencias" action="Abrir registro" actionHref="/gabinete">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          ["Reuniones", cabinetSummary.meetings.toString(), BookOpen],
          ["Decisiones", cabinetSummary.decisions.toString(), CheckCircle2],
          ["Pendientes", cabinetSummary.pending.toString(), Clock3],
          ["Vinculos", cabinetSummary.linkedProjects.toString(), GitBranch]
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="urban-lift rounded-lg border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-300/10 text-civic-sky">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-2xl font-black text-white">{value as string}</span>
            </div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 2xl:grid-cols-3">
        {cabinetMeetings.map((meeting) => (
          <article key={meeting.id} className="urban-lift group min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.82),rgba(31,137,246,0.12))]">
            <div className="border-b border-white/8 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                  {meeting.date}
                </span>
                <span className={`rounded-md border px-2 py-1 font-black ${cabinetStatusClass(meeting.status)}`}>{meeting.status}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-civic-sky">{meeting.area}</p>
                  <h3 className="mt-2 text-lg font-black leading-6 text-white group-hover:text-sky-100">{meeting.title}</h3>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <BookOpen className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_190px] 2xl:grid-cols-1">
              <div className="min-w-0">
                <p className="text-sm leading-6 text-slate-400">{meeting.summary}</p>

                <div className="mt-4 space-y-2">
                  {meeting.decisions.slice(0, 2).map((decision) => (
                    <div key={decision} className="flex items-start gap-2 text-sm leading-5 text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                      <span>{decision}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3">
                <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  Areas
                </p>
                <div className="flex flex-wrap gap-2">
                  {meeting.participants.slice(0, 4).map((participant) => (
                    <span key={participant} className="rounded-md border border-white/8 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-slate-300">{participant}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              {meeting.linkedProjectId ? (
                <Link href={`/proyectos/${meeting.linkedProjectId}`} className="urban-button inline-flex w-full items-center justify-between gap-3 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-3 text-sm font-black text-sky-100">
                  <span>Ver propuesta vinculada</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </Link>
              ) : (
                <button className="urban-button w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-black text-slate-300">Preparar propuesta</button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="urban-lift mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-black text-white">Audiencia sobre corredor norte</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Registro de fecha, expediente asociado, participantes, acta, documentos y conclusiones para analisis posterior.</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
function cabinetStatusClass(status: CabinetTopicStatus) {
  const styles: Record<CabinetTopicStatus, string> = {
    Pendiente: "border-slate-300/20 bg-slate-300/10 text-slate-200",
    "En analisis": "border-amber-300/20 bg-amber-300/10 text-amber-200",
    Priorizado: "border-sky-300/20 bg-sky-300/10 text-sky-200",
    Elevado: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
  };

  return styles[status];
}

function Panel({ title, action, actionHref, badge, children }: { title: string; action?: string; actionHref?: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="urban-card urban-lift min-w-0 rounded-lg p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug text-white">{title}</h2>
        {action && actionHref ? <Link href={actionHref} className="urban-button shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-sky-300">{action}</Link> : null}
        {action && !actionHref ? <button className="urban-button shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-sky-300">{action}</button> : null}
        {badge ? <span className="urban-pulse shrink-0 rounded-md bg-sky-400/15 px-2 py-1 text-xs font-bold text-sky-200">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

