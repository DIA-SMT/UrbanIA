import { ArrowRight, CheckCircle2, Clock3, Database, Layers3, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell";
import { modulePages, type ModulePageKey } from "@/lib/data";

type ModulePageProps = {
  moduleKey: ModulePageKey;
};

export function ModulePage({ moduleKey }: ModulePageProps) {
  const page = modulePages[moduleKey];

  return (
    <AppShell>
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
          <div>
            <div className="urban-pulse mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              <Sparkles className="h-4 w-4" />
              {page.eyebrow}
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">{page.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{page.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="urban-button inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-civic-ink">
                <Plus className="h-4 w-4" />
                {page.primaryAction}
              </button>
              <button className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200">
                Ver tablero
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {page.stats.map((stat) => (
              <div key={stat.label} className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
                <p className="text-2xl font-black text-civic-mint">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-3">
          {page.cards.map((card) => (
            <article key={card.title} className="urban-card urban-lift min-w-0 rounded-lg p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-md bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">{card.tag}</span>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              </div>
              <h2 className="text-lg font-black leading-tight text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{card.body}</p>
            </article>
          ))}
        </div>

        <aside className="urban-card urban-lift rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-400/15 text-cyan-200">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">Estado del modulo</h2>
              <p className="text-xs text-slate-500">Preparado para datos reales</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {["Estructura visual lista", "Modelo de datos inicial", "Vinculacion futura con IA"].map((item) => (
              <div key={item} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
                <Database className="h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>

          <div className="urban-lift mt-5 rounded-md border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
              <Clock3 className="h-4 w-4" />
              Proxima etapa
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">Cuando tengamos fuentes definitivas, reemplazamos estos contenidos por consultas, filtros y formularios conectados a datos reales.</p>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
