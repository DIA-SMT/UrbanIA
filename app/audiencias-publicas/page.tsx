import { PublicHearings } from "@/components/public/public-hearings";
import { SessionGate } from "@/components/public/session-gate";
import { getSessionUser } from "@/lib/auth/api";
import { listPublicHearings } from "@/lib/hearings/public-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audiencias publicas | UrbanIA",
  description: "Registro publico de las audiencias sobre las normas urbanas de San Miguel de Tucuman."
};

/**
 * Registro publico de audiencias. Vive en el portal ciudadano y usa una vista
 * recortada de los datos: el vecino no entra al sistema interno para ver esto.
 */
export default async function AudienciasPublicasPage() {
  // El registro pasa a exigir cuenta. La consulta a la base va DESPUES del
  // control: sin sesion no hay por que ir a buscar audiencias que no se van a
  // mostrar.
  const session = await getSessionUser();
  if (!session) {
    return (
      <SessionGate
        seccion="audiencias"
        eyebrow="Requiere cuenta"
        title="Audiencias públicas"
        detail="El registro de cada audiencia sobre las normas de la ciudad: cuándo fue, dónde, qué temas se trataron, a qué conclusiones se llegó y el resumen en PDF cuando está publicado."
        active="audiencias"
      />
    );
  }

  const hearings = process.env.DATABASE_URL ? await listPublicHearings().catch(() => []) : [];

  return <PublicHearings hearings={hearings} />;
}
