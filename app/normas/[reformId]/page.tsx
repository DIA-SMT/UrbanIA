import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionActor, hasPermission } from "@/lib/auth/api";
import { getReform, listReformDocuments } from "@/lib/projects/data";
import { NormsBoard } from "@/components/normas/norms-board";
import { SessionActorProvider } from "@/components/normas/session-actor";

export const dynamic = "force-dynamic";

export default async function ReformPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  // getSessionActor y no getSessionUser: el tablero muestra con que cuenta se
  // esta votando, y el voto propio se marca comparando su userId.
  const actor = await getSessionActor();
  if (!actor) redirect("/ingresar");
  // Pantalla interna: el rol Consulta la lee, los ciudadanos no entran.
  if (!canViewInternal(actor)) redirect("/");

  const [reform, documents] = await Promise.all([
    getReform(reformId).catch(() => null),
    listReformDocuments(reformId).catch(() => [])
  ]);
  if (!reform) notFound();

  const canEdit = hasPermission(actor, "norms.edit");

  return (
    <AppShell>
      <SessionActorProvider actor={{ userId: actor.userId, name: actor.name }}>
        <NormsBoard reform={reform} canEdit={canEdit} documents={documents} />
      </SessionActorProvider>
    </AppShell>
  );
}
