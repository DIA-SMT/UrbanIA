import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionUser, hasPermission } from "@/lib/auth/api";
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
  if (!canViewInternal(session)) redirect("/");

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) notFound();

  // Una bandera por permiso, no una sola para todo: esta pantalla dispara
  // operaciones de cuatro módulos distintos. Con un único `canEdit` quedaban
  // escondidos detrás de "editar audiencias" justo los dos permisos que un
  // administrador va a querer apagar primero — la IA, que cuesta plata por
  // llamada, y la publicación, que decide qué ve el vecino — y el botón se
  // mostraba igual para devolver 403 al apretarlo.
  const canEdit = hasPermission(session, "hearings.edit");
  const canDelete = hasPermission(session, "hearings.delete");
  const canRunAi = hasPermission(session, "ai.execute");
  const canPublish = hasPermission(session, "content.publish");
  const canUploadDocs = hasPermission(session, "documents.upload");
  const canDeleteDocs = hasPermission(session, "documents.delete");

  return (
    <AppShell>
      <HearingDetail
        hearing={hearing}
        canEdit={canEdit}
        canDelete={canDelete}
        canRunAi={canRunAi}
        canPublish={canPublish}
        canUploadDocs={canUploadDocs}
        canDeleteDocs={canDeleteDocs}
        aiAvailable={hasOpenRouterConfig()}
      />
    </AppShell>
  );
}
