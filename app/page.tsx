import { CitizenPortalLanding } from "@/components/public/citizen-portal-landing";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Los conteos salen del Codigo real cargado, no de numeros escritos a mano.
  const data = await getNormativeExplorerData();

  return <CitizenPortalLanding chapterCount={data.chapters.length} articleCount={data.articles.length} />;
}
