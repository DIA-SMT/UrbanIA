import { AppShell } from "@/components/shell";
import { NormativeExplorer } from "@/components/normative/normative-explorer";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export default async function NormativaPage() {
  const data = await getNormativeExplorerData();
  return <AppShell><NormativeExplorer data={data} /></AppShell>;
}
