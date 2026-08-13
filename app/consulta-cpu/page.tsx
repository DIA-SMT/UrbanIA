import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { CpuConsultation } from "@/components/cpu/cpu-consultation";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export default async function ConsultaCpuPage() {
  // El guard va ANTES de consultar: sin sesion interna no se toca la base. Esta
  // pantalla es ademas el cliente que le pega a /api/cpu, o sea la puerta de
  // entrada al RAG con material no publico.
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!canViewInternal(session)) redirect("/");

  const data = await getNormativeExplorerData();
  return (
    <AppShell>
      <CpuConsultation data={data} />
    </AppShell>
  );
}
