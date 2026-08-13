import { PublicHearings } from "@/components/public/public-hearings";
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
  const hearings = process.env.DATABASE_URL ? await listPublicHearings().catch(() => []) : [];

  return <PublicHearings hearings={hearings} />;
}
