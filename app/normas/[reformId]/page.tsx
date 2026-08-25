import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionActor, hasPermission } from "@/lib/auth/api";
import { getReform } from "@/lib/projects/data";
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

  // Los documentos aportados ya no se leen aca: viven en el expediente de la
  // audiencia donde se presentaron (/audiencias/<id>), que es de donde salieron.
  const reform = await getReform(reformId).catch(() => null);
  if (!reform) notFound();

  const canEdit = hasPermission(actor, "norms.edit");

  return (
    <AppShell>
      <SessionActorProvider actor={{ userId: actor.userId, name: actor.name }}>
        <NormsBoard reform={reform} canEdit={canEdit} />
      </SessionActorProvider>
    </AppShell>
  );
}
