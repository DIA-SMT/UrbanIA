import { CitizenPortalLanding } from "@/components/public/citizen-portal-landing";
import { getSessionUser } from "@/lib/auth/api";
import { getNormativeCounts } from "@/lib/normative/data";

/*
 * Render por request y NO `revalidate`, desde que la portada cambia segun haya
 * sesion o no. Con la pagina cacheada, la primera visita anonima congelaria la
 * version sin sesion y se la serviria despues a alguien que si entro --y al
 * reves--, que es una fuga de estado entre personas distintas. El costo son dos
 * count() cacheados por request.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  // Los conteos salen del Codigo real cargado, no de numeros escritos a mano.
  const [counts, session] = await Promise.all([getNormativeCounts(), getSessionUser()]);

  return (
    <CitizenPortalLanding
      chapterCount={counts.chapters}
      articleCount={counts.articles}
      hasSession={Boolean(session)}
    />
  );
}
