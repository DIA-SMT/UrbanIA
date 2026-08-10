import { notFound } from "next/navigation";
import { PublicHearingDetailView } from "@/components/public/public-hearing-detail";
import { getPublicHearing } from "@/lib/hearings/public-data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const hearing = process.env.DATABASE_URL ? await getPublicHearing(id).catch(() => null) : null;

  return {
    title: hearing ? `${hearing.title} | Audiencias publicas | UrbanIA` : "Audiencia publica | UrbanIA",
    description: hearing?.summary?.slice(0, 155) ?? "Registro publico de las audiencias sobre las normas urbanas de San Miguel de Tucuman."
  };
}

export default async function AudienciaPublicaPage({ params }: PageProps) {
  const { id } = await params;
  const hearing = process.env.DATABASE_URL ? await getPublicHearing(id).catch(() => null) : null;
  if (!hearing) notFound();

  return <PublicHearingDetailView hearing={hearing} />;
}
