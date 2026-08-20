import { CodeExplorer } from "@/components/public/code-explorer";
import { SessionGate } from "@/components/public/session-gate";
import { getSessionUser } from "@/lib/auth/api";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codigo de Planeamiento | UrbanIA",
  description: "Consulta los capitulos y articulos del Codigo de Planeamiento Urbano de San Miguel de Tucuman."
};

export default async function CodigoPage() {
  // Leer el Codigo pasa a exigir cuenta. El control va ANTES de cargar la
  // normativa: sin sesion no hay por que leer 52 articulos de la base.
  const session = await getSessionUser();
  if (!session) {
    return (
      <SessionGate
        seccion="codigo"
        eyebrow="Requiere cuenta"
        title="El Código de Planeamiento Urbano"
        detail="El texto oficial completo, capítulo por capítulo: zonificación, usos del suelo, alturas y retiros. Con la posibilidad de preguntarle a Migue, que responde citando el artículo en el que se apoya."
        active="codigo"
      />
    );
  }

  const data = await getNormativeExplorerData();

  // Sólo viajan los encabezados: el texto de cada artículo se pide al abrirlo
  // (son 100 KB entre los 52 artículos).
  const chapters = data.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
    title: chapter.title,
    articles: data.articles
      .filter((article) => article.chapterId === chapter.id)
      .map((article) => ({ number: article.number, title: article.title }))
  }));

  return (
    <CodeExplorer
      chapters={chapters}
      documentTitle={data.document.title}
      ordinanceNumber={data.document.ordinanceNumber}
      versionLabel={data.document.versionLabel}
      articleCount={data.articles.length}
    />
  );
}
