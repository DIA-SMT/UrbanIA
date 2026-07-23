import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { HearingDetail } from "@/components/hearings/hearing-detail";

export const dynamic = "force-dynamic";

export default async function HearingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) notFound();

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) notFound();

  const session = await getSessionUser();
  const canEdit = session ? isStaff(session.role) : false;
  const canDelete = session?.role === "ADMIN";

  return (
    <AppShell>
      <HearingDetail hearing={hearing} canEdit={canEdit} canDelete={canDelete} />
    </AppShell>
  );
}
