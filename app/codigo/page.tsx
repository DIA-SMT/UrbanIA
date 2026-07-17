import { CodeExplorer } from "@/components/public/code-explorer";
import { getNormativeExplorerData } from "@/lib/normative/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Codigo de Planeamiento | UrbanIA",
  description: "Consulta los capitulos y articulos del Codigo de Planeamiento Urbano de San Miguel de Tucuman."
};

export default async function CodigoPage() {
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
