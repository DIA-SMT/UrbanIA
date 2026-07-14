import { AppShell } from "@/components/shell";
import { CpuConsultation } from "@/components/cpu/cpu-consultation";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export default async function ConsultaCpuPage() {
  const data = await getNormativeExplorerData();
  return (
    <AppShell>
      <CpuConsultation data={data} />
    </AppShell>
  );
}
