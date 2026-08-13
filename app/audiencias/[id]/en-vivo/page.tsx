import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { getHearing } from "@/lib/hearings/data";
import { LiveSession } from "@/components/hearings/live/live-session";

export const dynamic = "force-dynamic";

/**
 * Sesion en vivo de una audiencia, direccionable por id: sirve tanto para
 * arrancar (recien creada) como para RETOMAR una audiencia en curso tras salir.
 * Carga las notas autoguardadas y la ficha.
 */
export default async function AudienciaEnVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!hasPermission(session, "hearings.edit")) redirect("/audiencias");

  if (!process.env.DATABASE_URL) notFound();

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) notFound();

  // Una audiencia ya cerrada o cancelada no se re-edita en vivo: va al detalle.
  if (hearing.hearingStatus === "COMPLETED" || hearing.hearingStatus === "CANCELLED") {
    redirect(`/audiencias/${id}`);
  }

  // Audiencia retomada (se cerro el navegador, se reinicio la maquina, o el
  // operador salio y volvio): la grabacion tiene que CONTINUAR la numeracion y
  // los tiempos. Arrancar de cero pisaria en el bucket los tramos ya subidos.
  const audioParts = hearing.mediaFiles.filter((media) => media.kind === "AUDIO");
  const firstPartIndex = audioParts.reduce((max, part) => Math.max(max, (part.partIndex ?? -1) + 1), 0);
  const baseOffsetMs = audioParts.reduce((end, part) => Math.max(end, (part.offsetMs ?? 0) + (part.durationSec ?? 0) * 1000), 0);

  return (
    <AppShell>
      <LiveSession
        meetingId={hearing.id}
        title={hearing.title}
        aiAvailable={hasOpenRouterConfig()}
        initialNotes={hearing.liveNotes ?? ""}
        initialFicha={hearing.ficha}
        recordedParts={audioParts.length}
        firstPartIndex={firstPartIndex}
        baseOffsetMs={baseOffsetMs}
      />
    </AppShell>
  );
}
