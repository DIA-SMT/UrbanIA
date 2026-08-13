import { redirect } from "next/navigation";
import { UrbanMapShell } from "@/components/map/urban-map-shell";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

/*
 * Guard propio: /admin no es solo la portada del sistema interno, es el destino
 * de rebote de casi todos los demas guards (lib/settings/guard.ts redirige aca
 * cuando falta el permiso, igual que el callback de Cidituc). Sin este chequeo,
 * a quien le falta permiso se lo empuja ADENTRO en vez de afuera.
 */
export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  if (!canViewInternal(session)) redirect("/");

  return <UrbanMapShell />;
}
