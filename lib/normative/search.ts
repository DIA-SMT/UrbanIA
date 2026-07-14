import { normalizeForSearch } from "@/lib/normative/parser";
import type { NormativeExplorerArticle } from "@/lib/normative/data";

export type RetrievedArticle = {
  id: string;
  number: string;
  title: string;
  content: string;
  chapterId: string | null;
  districts: string[];
  score: number;
};

// Palabras vacías y ruido normativo que no aportan a la recuperación por palabra clave.
const STOP_WORDS = new Set([
  "para",
  "cual",
  "cuales",
  "como",
  "cuando",
  "donde",
  "porque",
  "sobre",
  "entre",
  "hasta",
  "desde",
  "entonces",
  "tiene",
  "tienen",
  "puede",
  "pueden",
  "permite",
  "permiten",
  "exige",
  "exigen",
  "debe",
  "deben",
  "segun",
  "entre",
  "esta",
  "estan",
  "este",
  "esto",
  "esos",
  "esas",
  "aquel",
  "cada",
  "todo",
  "todos",
  "todas",
  "otra",
  "otras",
  "otro",
  "otros",
  "algun",
  "alguna",
  "codigo",
  "planeamiento",
  "urbano",
  "articulo",
  "articulos",
  "norma",
  "normativa",
  "cpu",
  "ordenanza",
  "municipal",
  "municipio",
  "quiero",
  "necesito",
  "consulta",
  "pregunta"
]);

// Sinónimos frecuentes -> término canónico usado en el texto del Código.
const SYNONYMS: Record<string, string[]> = {
  altura: ["alturas"],
  estacionamiento: ["estacionamientos", "cochera", "cocheras", "guardacoche"],
  retiro: ["retiros"],
  distrito: ["distritos", "zona", "zonas", "zonificacion"],
  edificacion: ["edificio", "edificios", "construccion", "construcciones"],
  frente: ["frentes", "frentista", "frentistas"],
  parcela: ["parcelas", "lote", "lotes", "terreno", "terrenos"],
  vivienda: ["viviendas", "habitacional", "residencial"],
  comercio: ["comercial", "comerciales", "comercios"],
  industria: ["industrial", "industriales", "industrias"]
};

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [canonical, variants] of Object.entries(SYNONYMS)) {
      if (token === canonical || variants.includes(token)) {
        expanded.add(canonical);
        variants.forEach((variant) => expanded.add(variant));
      }
    }
  }
  return [...expanded];
}

function tokenize(question: string): string[] {
  const normalized = normalizeForSearch(question);
  const rawTokens = normalized
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token));
  return expandTokens(rawTokens);
}

function countWholeWord(paddedContent: string, token: string): number {
  return paddedContent.split(` ${token} `).length - 1;
}

/**
 * Recuperación por palabra clave sobre el contenido normalizado de los artículos.
 * Devuelve los `limit` artículos más relevantes (score > 0), ordenados por score.
 */
export function retrieveRelevantArticles(
  articles: NormativeExplorerArticle[],
  question: string,
  limit = 6
): RetrievedArticle[] {
  const tokens = tokenize(question);
  const numericTokens = new Set(
    normalizeForSearch(question)
      .split(" ")
      .filter((token) => /^\d+$/.test(token))
  );

  if (!tokens.length && !numericTokens.size) {
    return [];
  }

  const scored = articles.map((article) => {
    const paddedContent = ` ${article.normalizedContent} `;
    const normalizedTitle = normalizeForSearch(article.title);
    const paddedTitle = ` ${normalizedTitle} `;
    const normalizedDistricts = article.districts.map((district) => normalizeForSearch(district));
    let score = 0;

    for (const token of tokens) {
      const bodyHits = countWholeWord(paddedContent, token);
      if (bodyHits > 0) {
        score += 2 + Math.min(bodyHits, 4);
      }
      if (paddedTitle.includes(` ${token} `)) {
        score += 6;
      }
      if (normalizedDistricts.includes(token)) {
        score += 5;
      }
    }

    // Referencia directa a un número de artículo ("articulo 45").
    if (numericTokens.has(article.number)) {
      score += 12;
    }

    return { article, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ article, score }) => ({
      id: article.id,
      number: article.number,
      title: article.title,
      content: article.content,
      chapterId: article.chapterId,
      districts: article.districts,
      score
    }));
}
