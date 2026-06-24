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
