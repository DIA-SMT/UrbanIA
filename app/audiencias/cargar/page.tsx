import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { hasAudioTranscription } from "@/lib/hearings/transcribe";
import { listReforms } from "@/lib/projects/data";
import { UploadHearing } from "@/components/hearings/cargar/upload-hearing";
import type { ReformOption } from "@/lib/hearings/shared";

export const dynamic = "force-dynamic";

export default async function CargarAudienciaPage() {
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
      console.error("No se pudieron cargar los codigos nuevos para la ingesta", error);
    }
  }

  return (
    <AppShell>
      <UploadHearing
        reforms={reforms}
        dbAvailable={dbAvailable}
        aiAvailable={hasOpenRouterConfig()}
        audioAvailable={hasAudioTranscription()}
      />
    </AppShell>
  );
}
