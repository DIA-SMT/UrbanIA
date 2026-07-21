import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getReform, listAuthorNames } from "@/lib/projects/data";
import { NormsBoard } from "@/components/normas/norms-board";

export const dynamic = "force-dynamic";

export default async function ReformPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const session = await getSessionUser();

  const [reform, knownAuthors] = await Promise.all([
    getReform(reformId).catch(() => null),
    listAuthorNames().catch(() => [])
  ]);
  if (!reform) notFound();

  const canEdit = session ? isStaff(session.role) : false;

  return (
    <AppShell>
      <NormsBoard reform={reform} canEdit={canEdit} knownAuthors={knownAuthors} />
    </AppShell>
  );
}
