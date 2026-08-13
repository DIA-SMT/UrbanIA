import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionUser, hasPermission } from "@/lib/auth/api";
import { getReform, listAuthorNames, listReformDocuments } from "@/lib/projects/data";
import { NormsBoard } from "@/components/normas/norms-board";

export const dynamic = "force-dynamic";

export default async function ReformPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  // Pantalla interna: el rol Consulta la lee, los ciudadanos no entran.
  if (!canViewInternal(session)) redirect("/");

  const [reform, knownAuthors, documents] = await Promise.all([
    getReform(reformId).catch(() => null),
    listAuthorNames().catch(() => []),
    listReformDocuments(reformId).catch(() => [])
  ]);
  if (!reform) notFound();

  const canEdit = session ? hasPermission(session, "norms.edit") : false;

  return (
    <AppShell>
      <NormsBoard reform={reform} canEdit={canEdit} knownAuthors={knownAuthors} documents={documents} />
    </AppShell>
  );
}
