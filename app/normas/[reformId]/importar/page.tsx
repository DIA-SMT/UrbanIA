import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { ImportDocument } from "@/components/normas/importar/import-document";

export const dynamic = "force-dynamic";

/**
 * Importador de PDFs a la Fabrica de Normas.
 *
 * Convive con /normas/[reformId]/[normId] sin conflicto: Next resuelve el
 * segmento estatico antes que el dinamico, igual que ya pasa con `nueva`.
 */
export default async function ImportarPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!hasPermission(session, "documents.upload")) redirect(`/normas/${reformId}`);

  const reform = await prisma.normativeReform
    .findUnique({ where: { id: reformId }, select: { id: true, code: true, title: true } })
    .catch(() => null);
  if (!reform) notFound();

  return (
    <AppShell>
      <ImportDocument reformId={reform.id} reformCode={reform.code} reformTitle={reform.title} />
    </AppShell>
  );
}
