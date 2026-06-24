import { AppShell } from "@/components/shell";
import { CityMap } from "@/components/city-map";
import { getDashboardData } from "@/lib/dashboard/data";
import {
  AssistantPanel,
  CabinetPanel,
  CitizenActivityPanel,
  CityComparisonPanel,
  DataSourcesPanel,
  IndicatorsPanel,
  ProposalSimulatorPanel,
  RegulationsPanel,
  SuccessCasesPanel
} from "@/components/dashboard-panels";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboardData();

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/35 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-white">Centro de inteligencia urbana</p>
          <p className="text-xs text-slate-500">Vista ejecutiva para explorar datos, propuestas y decisiones.</p>
        </div>
        <div className={`rounded-md px-3 py-2 text-xs font-bold ${dashboard.isLive ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>
          {dashboard.isLive ? "Datos en vivo" : "Modo demo"}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_260px_240px]">
        <div className="xl:col-span-2 2xl:col-span-1">
          <CityMap dashboardMetrics={dashboard.metrics} />
        </div>
        <ProposalSimulatorPanel />
        <AssistantPanel />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[260px_320px_minmax(380px,1fr)_300px]">
        <IndicatorsPanel />
        <CityComparisonPanel cities={dashboard.cityComparison} />
        <SuccessCasesPanel cases={dashboard.successCases} />
        <CitizenActivityPanel />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[400px_1fr_310px]">
        <RegulationsPanel items={dashboard.regulations} />
        <CabinetPanel />
        <DataSourcesPanel />
      </div>
    </AppShell>
  );
}
