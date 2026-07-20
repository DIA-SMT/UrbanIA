import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getNorm, getReform } from "@/lib/projects/data";
import { NormEditor } from "@/components/normas/form/norm-editor";

export const dynamic = "force-dynamic";

/**
 * Detalle de la norma: los mismos bloques del editor, con edicion inline por
 * bloque para el equipo y modo lectura para el resto. Incluye el historial de
 * analisis (trazabilidad).
 */
export default async function NormaPage({ params }: { params: Promise<{ reformId: string; normId: string }> }) {
  const { reformId, normId } = await params;

  if (!process.env.DATABASE_URL) notFound();

  // La sesion va primero porque getNorm la necesita: sin viewerId no puede resolver
  // el apoyo propio y los botones "A favor"/"En contra" arrancarian siempre neutros.
  const session = await getSessionUser();

  const [reform, norm] = await Promise.all([
    getReform(reformId).catch(() => null),
    getNorm(normId, session?.userId).catch(() => null)
  ]);
  if (!reform || !norm || norm.reformId !== reform.id) notFound();

  const canEdit = session ? isStaff(session.role) : false;
  const canDelete = session?.role === "ADMIN";

  return (
    <AppShell>
      <NormEditor reform={{ id: reform.id, code: reform.code, title: reform.title }} norm={norm} canEdit={canEdit} canDelete={canDelete} />
    </AppShell>
  );
}
