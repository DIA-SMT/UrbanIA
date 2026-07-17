import { NextResponse } from "next/server";
import { getNormativeExplorerData } from "@/lib/normative/data";
import { retrieveRelevantArticles } from "@/lib/normative/search";

export const dynamic = "force-dynamic";

/**
 * Explorador del Código para el portal público. Dos usos:
 *
 *   ?number=25   -> devuelve el texto completo de un artículo.
 *   ?q=altura    -> busca artículos por palabra clave (mismo motor que la Consulta al CPU).
 *
 * El contenido no viaja como props de la landing (son 100 KB entre 52 artículos):
 * se pide el artículo cuando el vecino lo abre.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const number = searchParams.get("number")?.trim();
  const query = searchParams.get("q")?.trim();

  try {
    const data = await getNormativeExplorerData();

    if (number) {
      const article = data.articles.find((item) => item.number === number);

      if (!article) {
        return NextResponse.json({ error: "No encontramos ese articulo." }, { status: 404 });
      }

      return NextResponse.json({
        article: {
          number: article.number,
          title: article.title,
          content: article.content,
          chapterId: article.chapterId,
          districts: article.districts
        }
      });
    }

    if (query && query.length >= 2) {
      const results = retrieveRelevantArticles(data.articles, query, 12);

      return NextResponse.json({
        results: results.map((article) => ({
          number: article.number,
          title: article.title,
          chapterId: article.chapterId,
          // Extracto corto para que el vecino vea por qué matcheó, sin traer todo el texto.
          excerpt: article.content.replace(/\s+/g, " ").trim().slice(0, 220)
        }))
      });
    }

    return NextResponse.json({ error: "Indica un numero de articulo o una busqueda." }, { status: 400 });
  } catch (error) {
    console.error("No se pudo leer el Codigo de Planeamiento.", error);
    return NextResponse.json({ error: "No pudimos leer el Codigo de Planeamiento." }, { status: 500 });
  }
}
