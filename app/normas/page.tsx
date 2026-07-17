import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { listReforms } from "@/lib/projects/data";
import { ReformsBoard } from "@/components/normas/reforms-board";
import type { ReformListItem } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  let reforms: ReformListItem[] = [];
  let isLive = false;

  if (process.env.DATABASE_URL) {
    try {
      reforms = await listReforms();
      isLive = true;
    } catch (error) {
      console.error("No se pudieron listar los codigos nuevos", error);
    }
  }

  const session = await getSessionUser();
  const canCreate = session ? isStaff(session.role) : false;

  return (
    <AppShell>
      <ReformsBoard reforms={reforms} isLive={isLive} canCreate={canCreate} />
    </AppShell>
  );
}
