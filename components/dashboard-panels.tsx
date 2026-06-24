import { ArrowUpRight, BookOpen, Building2, Circle, Database, FileText, Send } from "lucide-react";
import { cityComparison, indicators, proposals, regulations, successCases } from "@/lib/data";

export function IndicatorsPanel() {
  return (
    <Panel title="Indicadores clave" action="2024">
      <div className="space-y-4">
        {indicators.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-300">{item.label}</span>
            <span className="ml-auto font-semibold text-white">{item.value}</span>
            <span className="text-xs text-emerald-300">{item.delta}</span>
          </div>
        ))}
      </div>
      <button className="mt-6 text-sm font-semibold text-emerald-300">Ver todos los indicadores</button>
    </Panel>
  );
}

export function CityComparisonPanel() {
  const max = Math.max(...cityComparison.map((item) => item.value));
  return (
    <Panel title="Comparador de ciudades" action="Ver todas">
      <div className="mb-4 rounded-md border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-300">Indicador: Areas verdes (m2/hab)</div>
      <div className="space-y-3">
        {cityComparison.map((item) => (
          <div key={item.city} className="grid grid-cols-[minmax(84px,110px)_minmax(80px,1fr)_42px] items-center gap-3 text-sm">
            <span className="text-slate-300">{item.city}</span>
            <div className="h-3 rounded-full bg-slate-800">
              <div className={`h-3 rounded-full ${item.city === "Tucuman" ? "bg-emerald-400" : "bg-sky-500"}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="text-right text-slate-200">{item.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SuccessCasesPanel() {
  return (
    <Panel title="Casos de exito destacados" action="Ver todos">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {successCases.map((item, index) => (
          <article key={item.city} className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
            <div className={`h-24 ${index === 0 ? "bg-cyan-400/30" : index === 1 ? "bg-amber-400/30" : "bg-emerald-400/30"} map-grid`} />
            <div className="p-3">
              <p className="font-bold text-white">{item.city}</p>
              <p className="text-xs text-slate-400">{item.country}</p>
              <p className="mt-2 text-sm text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-400">{item.tag}</p>
              <button className="mt-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">Ver caso</button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function ProposalSimulatorPanel() {
  return (
    <Panel title="Simulador de propuestas" badge="Nuevo">
      <div className="h-32 rounded-md bg-[linear-gradient(135deg,rgba(16,185,129,0.25),rgba(14,165,233,0.20)),url('https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center" />
      <h3 className="mt-4 font-bold text-white">Nueva ciclovia en Av. Aconquija</h3>
      <div className="mt-4 space-y-3 text-sm">
        {["Movilidad +76%", "Ambiente +62%", "Seguridad +41%", "Economia local +28%"].map((item) => (
          <div key={item} className="flex items-center justify-between text-slate-300">
            <span>{item}</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-300" />
          </div>
        ))}
      </div>
      <button className="mt-5 w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-civic-ink">Ver simulacion conceptual</button>
    </Panel>
  );
}

export function AssistantPanel() {
  return (
    <Panel title="Asistente urbano" badge="IA">
      <div className="rounded-md border border-white/10 bg-slate-950/60 p-4">
        <p className="font-semibold text-white">Hola, Agustin.</p>
        <p className="mt-1 text-sm text-slate-400">En que puedo ayudarte hoy?</p>
      </div>
      <div className="mt-3 space-y-2">
        {["Que ordenanzas regulan la altura de edificios?", "Quiero mejorar el transito en Avenida Mate de Luna", "Casos de ciclovias en ciudades similares", "Normativa sobre espacios verdes"].map((prompt) => (
          <button key={prompt} className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.06]">{prompt}</button>
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
    <Panel title="Actividad ciudadana" action="Ver todo">
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
      <button className="mt-4 w-full rounded-md border border-emerald-300/40 py-2 text-sm font-semibold text-emerald-200">Nueva propuesta</button>
    </Panel>
  );
}

export function RegulationsPanel() {
  return (
    <Panel title="Normativa destacada" action="Ver todas">
      <div className="space-y-2">
        {regulations.map((item) => (
          <div key={item.number} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
            <FileText className="h-5 w-5 text-emerald-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">{item.number}</p>
              <p className="text-xs text-slate-500">{item.title}</p>
            </div>
            <button className="rounded-md bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">Ver</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DataSourcesPanel() {
  return (
    <Panel title="Fuentes de datos" action="Ver todas">
      {["Municipalidad de San Miguel de Tucuman", "INDEC", "Secretaria de Planeamiento", "Datos Abiertos Tucuman"].map((item) => (
        <div key={item} className="mb-3 flex items-center gap-3 text-sm text-slate-300">
          <Database className="h-5 w-5 text-sky-300" />
          {item}
        </div>
      ))}
    </Panel>
  );
}

export function CabinetPanel() {
  return (
    <Panel title="Registro de gabinete" action="Preparado">
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-300" />
          <p className="font-semibold text-white">Reunion semanal de gestion urbana</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">Ideas, acuerdos y pendientes podran convertirse en propuestas urbanas para analisis IA e informes.</p>
      </div>
    </Panel>
  );
}

function Panel({ title, action, badge, children }: { title: string; action?: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="urban-card min-w-0 rounded-lg p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold leading-snug text-white">{title}</h2>
        {action ? <button className="shrink-0 text-xs font-semibold text-emerald-300">{action}</button> : null}
        {badge ? <span className="shrink-0 rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-200">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}
