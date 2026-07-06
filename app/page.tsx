import { AppShell } from "@/components/shell";
import { CityMap } from "@/components/city-map";
import { PriorityAlerts } from "@/components/dashboard/priority-alerts";
import { TraceabilityFlow } from "@/components/dashboard/traceability-flow";
import { getDashboardData } from "@/lib/dashboard/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboardData();

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Centro de control urbano</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white md:text-4xl">Centro de Inteligencia Urbana</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400 md:text-base">Una visión integrada de propuestas, normativa, participación ciudadana y decisiones urbanas.</p></div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${dashboard.isLive ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"}`}><span className="h-2 w-2 rounded-full bg-current" />{dashboard.isLive ? "Datos institucionales conectados" : "Fuente local de respaldo"}</div>
      </div>
      <div className="space-y-6">
        <CityMap dashboardMetrics={dashboard.metrics} />
        <TraceabilityFlow />
        <PriorityAlerts />
      </div>
    </AppShell>
  );
}
