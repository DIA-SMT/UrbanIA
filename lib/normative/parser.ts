export const CPU_DOCUMENT_ID = "cpu-smt-2648-98-v2014-05";

export type ParsedNormativeChapter = {
  id: string;
  number: string;
  title: string;
  displayOrder: number;
};

export type ParsedNormativeArticle = {
  id: string;
  number: string;
  title: string;
  content: string;
  normalizedContent: string;
  chapterId: string | null;
  displayOrder: number;
  districts: string[];
  references: string[];
};

export type ParsedPlanningCode = {
  document: {
    id: string;
    title: string;
    ordinanceNumber: string;
    versionDate: string;
    jurisdiction: string;
    sourceName: string;
    sourcePath: string;
  };
  chapters: ParsedNormativeChapter[];
  articles: ParsedNormativeArticle[];
  integrity: {
    articleNumbers: number[];
    missingArticleNumbers: number[];
    duplicatedArticleNumbers: string[];
  };
};

const PAGE_HEADER = /Direcci[oó]n de Catastro y Edificaci[oó]n\s*[–-]\s*Digesto Normativo\s*[–-]\s*C[ÓO]DIGO DE PLANEAMIENTO URBANO\s*[–-]\s*ORDENANZA\s*N[º°.]?\s*2648\/98.*$/iu;
const ARTICLE_HEADING = /^ART[ÍI]CULO\s+(\d+)\s*[º°o]?\s*\.?-?\s*(.*)$/iu;
const CHAPTER_HEADING = /^CAP[ÍI]TULO\s+([IVXLCDM]+|\d+)\s*\.?\s*(.*)$/iu;

export function parsePlanningCode(source: string): ParsedPlanningCode {
  const allLines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const startIndex = allLines.findIndex((line) => /^C[ÓO]DIGO DE PLANEAMIENTO URBANO\s*-\s*ORDENANZA\s+N[º°]\s*2\.648\/98\s*$/iu.test(line.trim()));
  const scopedLines = startIndex >= 0 ? allLines.slice(startIndex) : allLines;
  const annexIndex = scopedLines.findIndex((line, index) => index > 20 && /^PLANOS DE\s*$/iu.test(line.trim()));
  const lines = annexIndex >= 0 ? scopedLines.slice(0, annexIndex) : scopedLines;
  const chapters: ParsedNormativeChapter[] = [];
  const articles: ParsedNormativeArticle[] = [];
  let currentChapter: ParsedNormativeChapter | null = null;
  let pendingChapterTitle = false;
  let currentArticle: { number: string; title: string; lines: string[]; chapterId: string | null } | null = null;

  const flushArticle = () => {
    if (!currentArticle) return;
    const content = cleanArticleContent(currentArticle.lines.join("\n"));
    const number = currentArticle.number;
    articles.push({
      id: `${CPU_DOCUMENT_ID}-art-${number}`,
      number,
      title: cleanHeading(currentArticle.title) || `Artículo ${number}`,
      content,
      normalizedContent: normalizeForSearch(`${currentArticle.title}\n${content}`),
      chapterId: currentArticle.chapterId,
      displayOrder: articles.length + 1,
      districts: extractDistrictCodes(`${currentArticle.title}\n${content}`),
      references: extractArticleReferences(content).filter((reference) => reference !== number)
    });
    currentArticle = null;
  };

  for (const sourceLine of lines) {
    const line = sourceLine.replace(/\f/g, "").trimEnd();
    if (isPageNoise(line)) continue;
    const trimmed = line.trim();
    const chapterMatch = trimmed.match(CHAPTER_HEADING);
    if (chapterMatch) {
      flushArticle();
      const number = chapterMatch[1].toUpperCase();
      currentChapter = { id: `${CPU_DOCUMENT_ID}-cap-${number.toLowerCase()}`, number, title: cleanHeading(chapterMatch[2]), displayOrder: chapters.length + 1 };
      chapters.push(currentChapter);
      pendingChapterTitle = !currentChapter.title;
      continue;
    }
    const articleMatch = trimmed.match(ARTICLE_HEADING);
    if (articleMatch) {
      if (currentArticle && articleMatch[1] === currentArticle.number && /modificad|derogad|reemplazad/iu.test(articleMatch[2])) {
        currentArticle.lines.push(trimmed);
        continue;
      }
      flushArticle();
      pendingChapterTitle = false;
      currentArticle = { number: articleMatch[1], title: cleanHeading(articleMatch[2]), lines: [], chapterId: currentChapter?.id ?? null };
      continue;
    }
    if (pendingChapterTitle && currentChapter && trimmed) {
      currentChapter.title = cleanHeading(trimmed);
      pendingChapterTitle = false;
      continue;
    }
    if (currentArticle) currentArticle.lines.push(line);
  }
  flushArticle();

  const counts = new Map<string, number>();
  articles.forEach((article) => counts.set(article.number, (counts.get(article.number) ?? 0) + 1));
  const articleNumbers = articles.map((article) => Number(article.number)).filter(Number.isFinite).sort((a, b) => a - b);
  const missingArticleNumbers: number[] = [];
  for (let number = articleNumbers[0] ?? 1; number <= (articleNumbers.at(-1) ?? 0); number += 1) if (!articleNumbers.includes(number)) missingArticleNumbers.push(number);

  return {
    document: {
      id: CPU_DOCUMENT_ID,
      title: "Código de Planeamiento Urbano",
      ordinanceNumber: "2648/98",
      versionDate: "2014-05-01",
      jurisdiction: "Municipalidad de San Miguel de Tucumán",
      sourceName: "Dirección de Catastro y Edificación – Digesto Normativo",
      sourcePath: "data/codigo-planeamiento-2014.txt"
    },
    chapters,
    articles,
    integrity: {
      articleNumbers,
      missingArticleNumbers,
      duplicatedArticleNumbers: [...counts.entries()].filter(([, count]) => count > 1).map(([number]) => number)
    }
  };
}

export function normalizeForSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanArticleContent(content: string) {
  return content.replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
}

function cleanHeading(value: string) {
  return value.replace(/^[.\-–—\s]+|[.\-–—\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function isPageNoise(line: string) {
  const trimmed = line.trim();
  return PAGE_HEADER.test(trimmed) || /^\d+\s*$/.test(trimmed) || /^P[aá]gina\s+\d+/iu.test(trimmed);
}

function extractDistrictCodes(content: string) {
  const codes = new Set<string>();
  const explicit = /(?:distrito(?:s)?|zona(?:s)?)\s+["“”']?([A-Z]{1,3}\s*\d{0,2}[a-z]?)/giu;
  for (const match of content.matchAll(explicit)) {
    const code = match[1].replace(/\s+/g, "");
    if (/^(?:C\d|R\d[a-z]?|S\d|I\d|AE\d|GE|PU|CC|LE\d?)$/i.test(code)) codes.add(code.toUpperCase());
  }
  return [...codes];
}

function extractArticleReferences(content: string) {
  const references = new Set<string>();
  for (const match of content.matchAll(/art[íi]culo(?:s)?\s+(\d+)/giu)) references.add(match[1]);
  return [...references];
}
