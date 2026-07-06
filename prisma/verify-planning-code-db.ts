import { PrismaClient } from "@prisma/client";
import { CPU_DOCUMENT_ID } from "../lib/normative/parser";

const prisma = new PrismaClient();

async function main() {
  const [document, chapters, articles, versions, districts, chunks] = await Promise.all([
    prisma.normativeDocument.findUnique({ where: { id: CPU_DOCUMENT_ID }, select: { id: true, title: true, versionDate: true, status: true } }),
    prisma.normativeChapter.count({ where: { documentId: CPU_DOCUMENT_ID } }),
    prisma.normativeArticle.count({ where: { documentId: CPU_DOCUMENT_ID } }),
    prisma.articleVersion.count({ where: { article: { documentId: CPU_DOCUMENT_ID } } }),
    prisma.district.count({ where: { sourceArticle: { documentId: CPU_DOCUMENT_ID } } }),
    prisma.knowledgeChunk.count({ where: { source: { externalId: "codigo-planeamiento-smt-2014" } } })
  ]);
  const articleNumbers = await prisma.normativeArticle.findMany({ where: { documentId: CPU_DOCUMENT_ID }, select: { articleNumber: true, content: true }, orderBy: { displayOrder: "asc" } });
  const result = { document, chapters, articles, versions, districts, chunks, emptyArticles: articleNumbers.filter((article) => !article.content.trim()).map((article) => article.articleNumber), firstArticle: articleNumbers[0]?.articleNumber, lastArticle: articleNumbers.at(-1)?.articleNumber };
  console.log(JSON.stringify(result, null, 2));
  if (!document || chapters !== 9 || articles !== 52 || versions !== 52 || chunks !== 52 || result.emptyArticles.length) process.exit(1);
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
