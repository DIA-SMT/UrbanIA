import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getReform } from "@/lib/projects/data";
import { NormsBoard } from "@/components/normas/norms-board";

export const dynamic = "force-dynamic";

export default async function ReformPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  // La sesion va primero: getReform la necesita para resolver el voto propio de
  // cada norma, si no los botones del tablero arrancan todos en neutro.
  const session = await getSessionUser();

  const reform = await getReform(reformId, session?.userId).catch(() => null);
  if (!reform) notFound();

  const canEdit = session ? isStaff(session.role) : false;

  return (
    <AppShell>
      <NormsBoard reform={reform} canEdit={canEdit} />
    </AppShell>
  );
}
