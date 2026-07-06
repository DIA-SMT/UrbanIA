import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePlanningCode } from "../lib/normative/parser";

async function main() {
  const source = await readFile(join(process.cwd(), "data", "codigo-planeamiento-2014.txt"), "utf8");
  const parsed = parsePlanningCode(source);
  const invalid = !parsed.chapters.length || !parsed.articles.length || parsed.integrity.duplicatedArticleNumbers.length > 0;
  console.log(JSON.stringify({ chapters: parsed.chapters.map((chapter) => `${chapter.number}: ${chapter.title}`), articles: parsed.articles.length, firstArticle: parsed.integrity.articleNumbers[0], lastArticle: parsed.integrity.articleNumbers.at(-1), missing: parsed.integrity.missingArticleNumbers, duplicates: parsed.integrity.duplicatedArticleNumbers, duplicateDetails: parsed.articles.filter((article) => parsed.integrity.duplicatedArticleNumbers.includes(article.number)).map((article) => ({ number: article.number, title: article.title, chapterId: article.chapterId })), emptyArticles: parsed.articles.filter((article) => !article.content).map((article) => article.number) }, null, 2));
  if (invalid) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
