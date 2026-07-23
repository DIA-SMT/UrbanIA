import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearingCounts, listHearings } from "@/lib/hearings/data";
import { listReforms } from "@/lib/projects/data";
import { HearingsBoard } from "@/components/hearings/hearings-board";
import type { HearingCounts, HearingListItem } from "@/lib/hearings/shared";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  let hearings: HearingListItem[] = [];
  let counts: HearingCounts = { upcoming: 0, processing: 0, completed: 0 };
  let reforms: Array<{ id: string; code: string; title: string }> = [];
  let isLive = false;

  if (process.env.DATABASE_URL) {
    try {
      const [hearingList, hearingCounts, reformList] = await Promise.all([listHearings(), getHearingCounts(), listReforms()]);
      hearings = hearingList;
      counts = hearingCounts;
      reforms = reformList.map((reform) => ({ id: reform.id, code: reform.code, title: reform.title }));
      isLive = true;
    } catch (error) {
      console.error("No se pudo cargar el registro de audiencias", error);
    }
  }

  const session = await getSessionUser();
  const canCreate = session ? isStaff(session.role) : false;

  return (
    <AppShell>
      <HearingsBoard hearings={hearings} counts={counts} reforms={reforms} isLive={isLive} canCreate={canCreate} />
    </AppShell>
  );
}
