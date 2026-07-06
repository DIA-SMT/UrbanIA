import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KnowledgeSourceKind, NormativeChangeType, NormativeStatus, PrismaClient, ProcessingStatus } from "@prisma/client";
import { parsePlanningCode } from "../lib/normative/parser";

const prisma = new PrismaClient();
const SOURCE_ID = "codigo-planeamiento-smt-2014";
const SOURCE_PATH = join(process.cwd(), "data", "codigo-planeamiento-2014.txt");

async function main() {
  const rawText = (await readFile(SOURCE_PATH, "utf8")).replace(/^\uFEFF/, "").trim();
  const parsed = parsePlanningCode(rawText);
  if (!parsed.articles.length || parsed.integrity.duplicatedArticleNumbers.length) throw new Error(`Integridad inválida: ${JSON.stringify(parsed.integrity)}`);

  await prisma.$transaction(async (tx) => {
    await tx.normativeDocument.upsert({
      where: { id: parsed.document.id },
      update: { title: parsed.document.title, documentType: "URBAN_CODE", ordinanceNumber: parsed.document.ordinanceNumber, versionDate: new Date(parsed.document.versionDate), jurisdiction: parsed.document.jurisdiction, sourceName: parsed.document.sourceName, sourcePath: parsed.document.sourcePath, status: NormativeStatus.HISTORICAL_REFERENCE },
      create: { id: parsed.document.id, title: parsed.document.title, documentType: "URBAN_CODE", ordinanceNumber: parsed.document.ordinanceNumber, versionDate: new Date(parsed.document.versionDate), jurisdiction: parsed.document.jurisdiction, sourceName: parsed.document.sourceName, sourcePath: parsed.document.sourcePath, status: NormativeStatus.HISTORICAL_REFERENCE }
    });
    for (const chapter of parsed.chapters) {
      await tx.normativeChapter.upsert({ where: { id: chapter.id }, update: { chapterNumber: chapter.number, title: chapter.title, displayOrder: chapter.displayOrder }, create: { id: chapter.id, documentId: parsed.document.id, chapterNumber: chapter.number, title: chapter.title, displayOrder: chapter.displayOrder } });
    }
    for (const article of parsed.articles) {
      const values = { chapterId: article.chapterId, articleNumber: article.number, title: article.title, content: article.content, normalizedContent: article.normalizedContent, status: NormativeStatus.HISTORICAL_REFERENCE, displayOrder: article.displayOrder, metadata: { districts: article.districts, articleReferences: article.references, sourceVersion: "2014-05" } };
      await tx.normativeArticle.upsert({ where: { id: article.id }, update: values, create: { id: article.id, documentId: parsed.document.id, ...values } });
    }
    await tx.articleVersion.deleteMany({ where: { article: { documentId: parsed.document.id } } });
    await tx.articleVersion.createMany({ data: parsed.articles.map((article) => ({ articleId: article.id, content: article.content, effectiveFrom: new Date(parsed.document.versionDate), changeType: NormativeChangeType.CREATED, notes: "Contenido de la fuente ordenada a mayo de 2014; vigencia posterior no verificada." })) });
    const districts = new Map<string, string>();
    parsed.articles.forEach((article) => article.districts.forEach((code) => districts.set(code, article.id)));
    for (const [code, sourceArticleId] of districts) {
      await tx.district.upsert({ where: { code }, update: { sourceArticleId }, create: { id: `cpu-district-${code.toLowerCase()}`, code, sourceArticleId } });
    }

    const source = await tx.knowledgeSource.upsert({ where: { kind_externalId: { kind: KnowledgeSourceKind.REGULATION, externalId: SOURCE_ID } }, update: { title: `${parsed.document.title} – texto ordenado a mayo de 2014`, filePath: parsed.document.sourcePath, mimeType: "text/plain", status: ProcessingStatus.READY, rawText, wordCount: rawText.split(/\s+/).length, processedAt: new Date(), metadata: { documentId: parsed.document.id, ordinanceNumber: parsed.document.ordinanceNumber, version: "2014-05", structured: true } }, create: { kind: KnowledgeSourceKind.REGULATION, externalId: SOURCE_ID, title: `${parsed.document.title} – texto ordenado a mayo de 2014`, filePath: parsed.document.sourcePath, mimeType: "text/plain", status: ProcessingStatus.READY, rawText, wordCount: rawText.split(/\s+/).length, processedAt: new Date(), metadata: { documentId: parsed.document.id, ordinanceNumber: parsed.document.ordinanceNumber, version: "2014-05", structured: true } } });
    await tx.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeChunk.createMany({ data: parsed.articles.map((article, chunkIndex) => ({ sourceId: source.id, chunkIndex, content: article.content, tokenEstimate: Math.ceil(article.content.length / 4), metadata: { documentId: parsed.document.id, chapterId: article.chapterId, articleId: article.id, articleNumber: article.number, title: article.title, districts: article.districts, sourceVersion: "2014-05" } })) });
  }, { timeout: 30_000 });

  console.log(JSON.stringify({ document: parsed.document.id, chapters: parsed.chapters.length, articles: parsed.articles.length, districts: new Set(parsed.articles.flatMap((article) => article.districts)).size, integrity: parsed.integrity }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
