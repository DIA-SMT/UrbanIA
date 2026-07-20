import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { listReforms } from "@/lib/projects/data";
import { ReformsBoard } from "@/components/normas/reforms-board";
import { EMPTY_TOPICS_DEMAND, type TopicsDemandPayload } from "@/lib/citizen/shared";
import { getTopicsDemand } from "@/lib/citizen/topics-demand";
import type { ReformListItem } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  let reforms: ReformListItem[] = [];
  let isLive = false;

  const session = await getSessionUser();
  const canCreate = session ? isStaff(session.role) : false;

  // La demanda ciudadana solo se calcula para el equipo: son textos de vecinos
  // identificables, y el mismo criterio que aplica la API tiene que aplicar acá.
  let demand: TopicsDemandPayload = EMPTY_TOPICS_DEMAND;

  if (process.env.DATABASE_URL) {
    const [reformsResult, demandResult] = await Promise.all([
      listReforms().catch((error) => {
        console.error("No se pudieron listar los codigos nuevos", error);
        return null;
      }),
      canCreate
        ? getTopicsDemand().catch((error) => {
            console.error("No se pudo calcular la demanda por tema", error);
            return null;
          })
        : Promise.resolve(null)
    ]);

    if (reformsResult) {
      reforms = reformsResult;
      isLive = true;
    }
    if (demandResult) demand = demandResult;
  }

  return (
    <AppShell>
      <ReformsBoard reforms={reforms} isLive={isLive} canCreate={canCreate} demand={demand} />
    </AppShell>
  );
}
