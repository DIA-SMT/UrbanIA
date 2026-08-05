import { AppShell } from "@/components/shell";
import { HelpCenter } from "@/components/help/help-center";
import { getSessionUser, isStaff } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ayuda | UrbanIA",
  description: "Guia paso a paso de las herramientas de UrbanIA, para vecinos y para el equipo municipal."
};

/**
 * Centro de ayuda de la plataforma. La sesion se lee en el servidor solo para
 * elegir la seccion inicial (equipo municipal si hay rol staff) y para que la
 * seccion interna muestre el aviso de acceso cuando corresponde: la pagina es
 * legible por cualquiera, el gating real vive en cada herramienta.
 */
export default async function AyudaPage() {
  const session = await getSessionUser().catch(() => null);
  const isStaffSession = Boolean(session && isStaff(session.role));

  return (
    <AppShell>
      <HelpCenter isStaffSession={isStaffSession} />
    </AppShell>
  );
}
