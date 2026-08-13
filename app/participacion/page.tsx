import { redirect } from "next/navigation";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { CitizenParticipation } from "@/components/citizen/citizen-participation";

export const dynamic = "force-dynamic";

/**
 * Bandeja de aportes ciudadanos: es una herramienta INTERNA de triage. Muestra
 * nombre, DNI, zona y email de cada vecino, y permite contactarlo y cambiar el
 * estado de su propuesta. El vecino carga su aporte desde el portal publico
 * (components/public/contribution-form.tsx), no desde aca.
 *
 * Exige proposals.manage y NO internal.view, aunque internal.view alcance para
 * el resto del sistema interno. La razon es que la matriz de permisos ahora es
 * editable: el dia que se le conceda internal.view al rol Ciudadano --que es un
 * escenario contemplado-- esa casilla no puede significar tambien "leer el
 * nombre, el DNI y el email de todos los vecinos que presentaron algo". Su
 * etiqueta promete mapas, normas, audiencias y documentos, y tiene que cumplir
 * exactamente eso.
 */
export default async function ParticipacionPage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!hasPermission(session, "proposals.manage")) redirect("/");

  return <CitizenParticipation />;
}
