import { NextResponse } from "next/server";
import { getNormativeExplorerData, type NormativeExplorerArticle } from "@/lib/normative/data";
import { retrieveRelevantArticles } from "@/lib/normative/search";
import { normalizeForSearch } from "@/lib/normative/parser";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;
const EXCERPT_RADIUS = 90;

function buildExcerpt(article: NormativeExplorerArticle, query: string): string {
  const content = article.content.replace(/\s+/g, " ").trim();
  const tokens = normalizeForSearch(query)
    .split(" ")
    .filter((token) => token.length >= 4);
  const normalizedContent = normalizeForSearch(content);
  let index = -1;
  for (const token of tokens) {
    const found = normalizedContent.indexOf(token);
    if (found >= 0) {
      index = found;
      break;
    }
  }
  if (index < 0) {
    return content.length > EXCERPT_RADIUS * 2 ? `${content.slice(0, EXCERPT_RADIUS * 2).trimEnd()}…` : content;
  }
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(content.length, index + EXCERPT_RADIUS);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${end < content.length ? "…" : ""}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ articles: [], isLive: true });
  }

  let data: Awaited<ReturnType<typeof getNormativeExplorerData>>;
  try {
    data = await getNormativeExplorerData();
  } catch (error) {
    console.error("No se pudo cargar la normativa para búsqueda", error);
    return NextResponse.json({ articles: [], isLive: false });
  }

  const articleById = new Map(data.articles.map((article) => [article.id, article]));
  const scored = new Map<string, { article: NormativeExplorerArticle; score: number }>();

  // 1) Búsqueda por palabra clave (ya prioriza match por número de artículo).
  for (const result of retrieveRelevantArticles(data.articles, query, MAX_RESULTS)) {
    const article = articleById.get(result.id);
    if (article) scored.set(article.id, { article, score: result.score });
  }

  // 2) Match exacto por número de artículo tipeado ("art 25", "12").
  const numberTokens = query.match(/\d{1,4}/g) ?? [];
  for (const token of numberTokens) {
    const article = data.articles.find((entry) => entry.number === token);
    if (article) {
      const current = scored.get(article.id);
      scored.set(article.id, { article, score: (current?.score ?? 0) + 20 });
    }
  }

  // 3) Búsqueda por ordenanza: si el query menciona el número de la ordenanza del
  //    documento, se ofrecen sus artículos (por orden) como resultados amplios.
  const ordinanceDigits = (data.document.ordinanceNumber ?? "").replace(/\D/g, "");
  const queryDigits = query.replace(/\D/g, "");
  const mentionsOrdinance = ordinanceDigits.length >= 4 && queryDigits.length >= 4 && ordinanceDigits.startsWith(queryDigits.slice(0, 4));
  if (mentionsOrdinance) {
    for (const article of data.articles.slice(0, MAX_RESULTS)) {
      if (!scored.has(article.id)) scored.set(article.id, { article, score: 1 });
    }
  }

  const articles = [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((entry) => ({
      id: entry.article.id,
      number: entry.article.number,
      title: entry.article.title,
      excerpt: buildExcerpt(entry.article, query),
      documentTitle: data.document.title,
      score: entry.score
    }));

  return NextResponse.json({ articles, isLive: data.source === "database" });
}
