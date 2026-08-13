import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DebateDetailView } from "@/components/foro/debate-detail";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { getDebateDetail } from "@/lib/foro/data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DebatePage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!canViewInternal(session)) redirect("/");

  const { id } = await params;
  const canModerate = hasPermission(session, "debates.moderate");
  const debate = await getDebateDetail(id, { userId: session.userId, canModerate });
  if (!debate) notFound();

  return (
    <AppShell>
      <DebateDetailView
        debate={debate}
        canParticipate={hasPermission(session, "debates.participate")}
        canModerate={canModerate}
        canManage={hasPermission(session, "debates.create")}
      />
    </AppShell>
  );
}
