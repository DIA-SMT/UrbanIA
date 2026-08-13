import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { getHearing } from "@/lib/hearings/data";
import { HearingDetail } from "@/components/hearings/hearing-detail";

export const dynamic = "force-dynamic";

export default async function HearingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) notFound();

  // El guard va ANTES de leer la audiencia: sin sesion interna no se toca la base.
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  // Pantalla interna: el rol Consulta la lee, los ciudadanos no entran.
  if (!canViewInternal(session.role)) redirect("/");

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) notFound();

  const canEdit = isStaff(session.role);
  const canDelete = session?.role === "ADMIN";

  return (
    <AppShell>
      <HearingDetail hearing={hearing} canEdit={canEdit} canDelete={canDelete} aiAvailable={hasOpenRouterConfig()} />
    </AppShell>
  );
}
