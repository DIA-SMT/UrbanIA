import { CitizenPortalLanding } from "@/components/public/citizen-portal-landing";
import { getNormativeCounts } from "@/lib/normative/data";

// La portada solo muestra cuantos capitulos y articulos tiene el Codigo, que es
// un texto de 2014: no hace falta render dinamico por request. Antes era
// force-dynamic y ademas bajaba el articulado completo (~230 KB) para dos
// numeros; ahora son dos count() cacheados.
export const revalidate = 3600;

export default async function Home() {
  // Los conteos salen del Codigo real cargado, no de numeros escritos a mano.
  const counts = await getNormativeCounts();

  return <CitizenPortalLanding chapterCount={counts.chapters} articleCount={counts.articles} />;
}
