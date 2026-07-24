import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { CPU_DOCUMENT_ID, parsePlanningCode } from "@/lib/normative/parser";

/**
 * El Codigo de Planeamiento es un texto ordenado a 2014: no cambia salvo que
 * alguien vuelva a importarlo con un script. Sin cache, sus ~230 KB (el texto
 * viaja dos veces: content y normalizedContent) se bajaban de Supabase en CADA
 * request de la home, /codigo, /consulta-cpu, el asistente y el diagnostico:
 * medido, 343 ms de ida y vuelta por llamada.
 *
 * Para forzar el refresco tras una reimportacion: revalidateTag("normative-code").
 */
const CACHE_TAG = "normative-code";
const CACHE_TTL_SECONDS = 3600;

export type NormativeExplorerChapter = { id: string; number: string; title: string; displayOrder: number };
export type NormativeExplorerLink = { id: string; sourceType: string; sourceId: string; relationshipType: string; notes: string | null };
export type NormativeExplorerArticle = { id: string; number: string; title: string; content: string; normalizedContent: string; chapterId: string | null; displayOrder: number; districts: string[]; references: string[]; links: NormativeExplorerLink[] };
export type NormativeExplorerData = { document: { id: string; title: string; ordinanceNumber: string; versionLabel: string; jurisdiction: string; sourceName: string; status: "historical_reference" }; chapters: NormativeExplorerChapter[]; articles: NormativeExplorerArticle[]; source: "database" | "verified_file" };

async function loadNormativeExplorerData(): Promise<NormativeExplorerData> {
  if (process.env.DATABASE_URL) {
    try {
      const document = await prisma.normativeDocument.findUnique({
        where: { id: CPU_DOCUMENT_ID },
        include: { chapters: { orderBy: { displayOrder: "asc" } }, articles: { orderBy: { displayOrder: "asc" }, include: { links: true } } }
      });
      if (document?.articles.length) {
        return { document: { id: document.id, title: document.title, ordinanceNumber: document.ordinanceNumber ?? "2648/98", versionLabel: document.versionDate ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(document.versionDate) : "mayo de 2014", jurisdiction: document.jurisdiction, sourceName: document.sourceName, status: "historical_reference" }, chapters: document.chapters.map((chapter) => ({ id: chapter.id, number: chapter.chapterNumber, title: chapter.title, displayOrder: chapter.displayOrder })), articles: document.articles.map((article) => { const metadata = asMetadata(article.metadata); return { id: article.id, number: article.articleNumber, title: article.title ?? `Artículo ${article.articleNumber}`, content: article.content, normalizedContent: article.normalizedContent, chapterId: article.chapterId, displayOrder: article.displayOrder, districts: metadata.districts, references: metadata.articleReferences, links: article.links.map((link) => ({ id: link.id, sourceType: link.sourceType, sourceId: link.sourceId, relationshipType: link.relationshipType, notes: link.notes })) }; }), source: "database" };
      }
    } catch (error) {
      console.warn("Structured normative tables unavailable; using verified source file.", error instanceof Error ? error.message : error);
    }
  }

  const raw = await readFile(join(process.cwd(), "data", "codigo-planeamiento-2014.txt"), "utf8");
  const parsed = parsePlanningCode(raw);
  return { document: { id: parsed.document.id, title: parsed.document.title, ordinanceNumber: parsed.document.ordinanceNumber, versionLabel: "mayo de 2014", jurisdiction: parsed.document.jurisdiction, sourceName: parsed.document.sourceName, status: "historical_reference" }, chapters: parsed.chapters.map((chapter) => ({ id: chapter.id, number: chapter.number, title: chapter.title, displayOrder: chapter.displayOrder })), articles: parsed.articles.map((article) => ({ ...article, links: [] })), source: "verified_file" };
}

export const getNormativeExplorerData = unstable_cache(loadNormativeExplorerData, ["normative-explorer-data"], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [CACHE_TAG]
});

/**
 * Solo los conteos del Codigo. La portada publica los usa para dos numeros y
 * antes se bajaba el articulado entero para hacer `.length`.
 */
export const getNormativeCounts = unstable_cache(
  async (): Promise<{ chapters: number; articles: number }> => {
    if (process.env.DATABASE_URL) {
      try {
        const [chapters, articles] = await Promise.all([
          prisma.normativeChapter.count({ where: { documentId: CPU_DOCUMENT_ID } }),
          prisma.normativeArticle.count({ where: { documentId: CPU_DOCUMENT_ID } })
        ]);
        if (articles > 0) return { chapters, articles };
      } catch {
        // Tablas no migradas: se cae al archivo verificado, igual que el explorador.
      }
    }
    const data = await loadNormativeExplorerData();
    return { chapters: data.chapters.length, articles: data.articles.length };
  },
  ["normative-counts"],
  { revalidate: CACHE_TTL_SECONDS, tags: [CACHE_TAG] }
);

function asMetadata(value: unknown): { districts: string[]; articleReferences: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { districts: [], articleReferences: [] };
  const data = value as Record<string, unknown>;
  return { districts: Array.isArray(data.districts) ? data.districts.filter((item): item is string => typeof item === "string") : [], articleReferences: Array.isArray(data.articleReferences) ? data.articleReferences.filter((item): item is string => typeof item === "string") : [] };
}
