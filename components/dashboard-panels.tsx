import Link from "next/link";
import { Database, FileText, Send } from "lucide-react";
import { cityComparison, indicators, proposals, regulations, successCases } from "@/lib/data";
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

