import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { getHearing } from "@/lib/hearings/data";
import { LiveSession } from "@/components/hearings/live/live-session";

export const dynamic = "force-dynamic";

/**
 * Sesion en vivo de una audiencia, direccionable por id: sirve tanto para
 * arrancar (recien creada) como para RETOMAR una audiencia en curso tras salir.
 * Carga el borrador autoguardado y los cruces ya persistidos.
 */
export default async function AudienciaEnVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!isStaff(session.role)) redirect("/audiencias");

  if (!process.env.DATABASE_URL) notFound();

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) notFound();

  // Una audiencia ya cerrada o cancelada no se re-edita en vivo: va al detalle.
  if (hearing.hearingStatus === "COMPLETED" || hearing.hearingStatus === "CANCELLED") {
    redirect(`/audiencias/${id}`);
  }

  // Sin código nuevo (tema libre) igual se dicta: solo se desactiva el cruce.
  return (
    <AppShell>
      <LiveSession
        meetingId={hearing.id}
        title={hearing.title}
        reformId={hearing.reformId}
        aiAvailable={hasOpenRouterConfig()}
        initialTranscript={hearing.draftTranscript ?? ""}
        initialMatches={hearing.matches}
        initialFicha={hearing.ficha}
      />
    </AppShell>
  );
}
