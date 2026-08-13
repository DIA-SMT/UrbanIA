import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canViewInternal, getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearingCounts, listHearings } from "@/lib/hearings/data";
import { listReformOptions } from "@/lib/projects/data";
import { HearingsBoard } from "@/components/hearings/hearings-board";
import type { HearingCounts, HearingListItem } from "@/lib/hearings/shared";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  let hearings: HearingListItem[] = [];
  let counts: HearingCounts = { upcoming: 0, processing: 0, completed: 0 };
  let reforms: Array<{ id: string; code: string; title: string }> = [];
  let isLive = false;

  // El guard va ANTES de consultar: sin sesion interna no se toca la base.
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  // Pantalla interna: el rol Consulta la lee, los ciudadanos no entran.
  if (!canViewInternal(session.role)) redirect("/");
  const canCreate = isStaff(session.role);

  if (process.env.DATABASE_URL) {
    try {
      // listReformOptions y no listReforms: el board solo llena un select con
      // id/code/title, y el listado completo arrastra normas, autor y el
      // diagnostico de cada norma.
      const [hearingList, hearingCounts, reformList] = await Promise.all([
        listHearings(),
        getHearingCounts(),
        listReformOptions()
      ]);
      hearings = hearingList;
      counts = hearingCounts;
      reforms = reformList;
      isLive = true;
    } catch (error) {
      console.error("No se pudo cargar el registro de audiencias", error);
    }
  }

  return (
    <AppShell>
      <HearingsBoard hearings={hearings} counts={counts} reforms={reforms} isLive={isLive} canCreate={canCreate} />
    </AppShell>
  );
}
