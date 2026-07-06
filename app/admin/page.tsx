import { AppShell } from "@/components/shell";
import { CityMap } from "@/components/city-map";
import { getDashboardData } from "@/lib/dashboard/data";
import {
  AssistantPanel,
  CabinetPanel,
  CitizenActivityPanel,
  DataSourcesPanel,
  ProposalSimulatorPanel,
  RegulationsPanel
} from "@/components/dashboard-panels";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const dashboard = await getDashboardData();

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/35 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-white">Mesa de deliberacion urbana</p>
          <p className="text-xs text-slate-500">Propuestas oficiales, Codigo de Planeamiento, audiencias y aportes ciudadanos vinculados por IA.</p>
        </div>
        <div className={`rounded-md px-3 py-2 text-xs font-bold ${dashboard.isLive ? "bg-sky-400/15 text-sky-200" : "bg-amber-400/15 text-amber-200"}`}>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(360px,1fr)_320px_300px]">
        <RegulationsPanel items={dashboard.regulations} />
        <CabinetPanel />
        <CitizenActivityPanel />
      </div>

      <div className="mt-4">
        <DataSourcesPanel />
      </div>
    </AppShell>
  );
}
