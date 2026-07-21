import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { getReform } from "@/lib/projects/data";
import { NormEditor } from "@/components/normas/form/norm-editor";

export const dynamic = "force-dynamic";

export default async function NuevaNormaPage({ params }: { params: Promise<{ reformId: string }> }) {
  const { reformId } = await params;

  const session = await getSessionUser();
  if (!session) {
    redirect("/ingresar");
  }
  if (!isStaff(session.role)) {
    redirect("/normas");
  }

  if (!process.env.DATABASE_URL) notFound();

  // El nombre no viaja en la sesion (solo userId y role): se resuelve aca para
  // mostrar con que cuenta se esta redactando.
  const [reform, account] = await Promise.all([
    getReform(reformId, session.userId).catch(() => null),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }).catch(() => null)
  ]);
  if (!reform) notFound();

  return (
    <AppShell>
      <NormEditor
        reform={{ id: reform.id, code: reform.code, title: reform.title }}
        norm={null}
        canEdit
        accountName={account?.name ?? null}
      />
    </AppShell>
  );
}
