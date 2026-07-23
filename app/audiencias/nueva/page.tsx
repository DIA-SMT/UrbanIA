import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { listReforms } from "@/lib/projects/data";
import { NewHearingFlow } from "@/components/hearings/nueva/new-hearing-flow";
import type { ReformOption } from "@/lib/hearings/shared";

export const dynamic = "force-dynamic";

export default async function NuevaAudienciaPage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!isStaff(session.role)) redirect("/audiencias");

  const dbAvailable = Boolean(process.env.DATABASE_URL);
  let reforms: ReformOption[] = [];

  if (dbAvailable) {
    try {
      reforms = (await listReforms())
        .filter((reform) => reform.status !== "ARCHIVED")
        .map((reform) => ({ id: reform.id, code: reform.code, title: reform.title }));
    } catch (error) {
      console.error("No se pudieron cargar los codigos nuevos para la audiencia", error);
    }
  }

  return (
    <AppShell>
      <NewHearingFlow reforms={reforms} dbAvailable={dbAvailable} />
    </AppShell>
  );
}
