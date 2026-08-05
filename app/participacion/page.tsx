import { redirect } from "next/navigation";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
import { CitizenParticipation } from "@/components/citizen/citizen-participation";

export const dynamic = "force-dynamic";

/**
 * Bandeja de aportes ciudadanos: es una herramienta INTERNA de triage. Muestra
 * nombre, DNI, zona y email de cada vecino, y permite contactarlo y cambiar el
 * estado de su propuesta, asi que exige sesion municipal. El vecino carga su
 * aporte desde el portal publico (components/public/contribution-form.tsx), no
 * desde aca.
 */
export default async function ParticipacionPage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  // Es una bandeja de lectura/triage: el rol Observador también puede verla.
  if (!canViewInternal(session.role)) redirect("/");

  return <CitizenParticipation />;
}
