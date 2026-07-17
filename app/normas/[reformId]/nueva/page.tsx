import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
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

  const reform = await getReform(reformId).catch(() => null);
  if (!reform) notFound();

  return (
    <AppShell>
      <NormEditor reform={{ id: reform.id, code: reform.code, title: reform.title }} norm={null} canEdit />
    </AppShell>
  );
}
