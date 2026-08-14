import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionActor, hasPermission } from "@/lib/auth/api";
import { getNorm, getReform } from "@/lib/projects/data";
import { NormEditor } from "@/components/normas/form/norm-editor";
import { SessionActorProvider } from "@/components/normas/session-actor";

export const dynamic = "force-dynamic";

/**
 * Detalle de la norma: los mismos bloques del editor, con edicion inline por
 * bloque para el equipo y modo lectura para el resto. Incluye el historial de
 * analisis (trazabilidad).
 */
export default async function NormaPage({ params }: { params: Promise<{ reformId: string; normId: string }> }) {
  const { reformId, normId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  // getSessionActor y no getSessionUser: la pantalla necesita el nombre de la
  // cuenta para mostrar con quien se esta votando y firmando.
  const actor = await getSessionActor();
  if (!actor) redirect("/ingresar");
  // Pantalla interna: el rol Consulta la lee, los ciudadanos no entran.
  if (!canViewInternal(actor)) redirect("/");

  const [reform, norm] = await Promise.all([
    getReform(reformId).catch(() => null),
    getNorm(normId).catch(() => null)
  ]);
  if (!reform || !norm || norm.reformId !== reform.id) notFound();

  const canEdit = hasPermission(actor, "projects.edit");
  const canDelete = hasPermission(actor, "projects.delete");

  return (
    <AppShell>
      <SessionActorProvider actor={{ userId: actor.userId, name: actor.name }}>
        <NormEditor
          reform={{ id: reform.id, code: reform.code, title: reform.title }}
          norm={norm}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </SessionActorProvider>
    </AppShell>
  );
}
