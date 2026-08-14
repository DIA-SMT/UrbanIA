import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionActor, hasPermission } from "@/lib/auth/api";
import { getReform } from "@/lib/projects/data";
import { NormEditor } from "@/components/normas/form/norm-editor";
import { SessionActorProvider } from "@/components/normas/session-actor";

export const dynamic = "force-dynamic";

export default async function NuevaNormaPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  // El nombre no viaja en la sesion (solo userId y role): getSessionActor lo
  // resuelve para mostrar con que cuenta se esta redactando, que es la misma con
  // la que el servidor va a firmar la norma.
  const actor = await getSessionActor();
  if (!actor) {
    redirect("/ingresar");
  }
  if (!hasPermission(actor, "projects.create")) {
    redirect("/normas");
  }

  if (!process.env.DATABASE_URL) notFound();

  const reform = await getReform(reformId).catch(() => null);
  if (!reform) notFound();

  return (
    <AppShell>
      <SessionActorProvider actor={{ userId: actor.userId, name: actor.name }}>
        <NormEditor reform={{ id: reform.id, code: reform.code, title: reform.title }} norm={null} canEdit />
      </SessionActorProvider>
    </AppShell>
  );
}
