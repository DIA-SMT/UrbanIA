import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { StaffHelpCenter } from "@/components/help/staff-help-center";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ayuda | UrbanIA",
  description: "Manual operativo de las herramientas internas de UrbanIA."
};

/**
 * Manual del equipo municipal. Vive bajo /admin (que el middleware ya protege)
 * y ademas revalida el permiso acá: describe el circuito interno de trabajo, no
 * es documentacion publica. La guia del vecino esta en /ayuda.
 */
export default async function AyudaInternaPage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!canViewInternal(session)) redirect("/");

  return (
    <AppShell>
      <StaffHelpCenter />
    </AppShell>
  );
}
