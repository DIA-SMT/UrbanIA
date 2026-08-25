import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Indice del Codigo de Planeamiento: numero y titulo de cada articulo.
 *
 * Existe para que el cruce NO sea alucinable. Si al modelo se le pregunta "que
 * articulos toca esta propuesta" sin darle el codigo, devuelve numeros
 * plausibles e inventados, y en una plataforma normativa eso es peor que no
 * responder: alguien podria redactar una modificacion contra un articulo que
 * dice otra cosa. Con el indice a la vista, el modelo ELIGE de una lista real y
 * despues se valida que lo elegido exista.
 *
 * Entra completo en el prompt sin problema: el CPU son 52 articulos y el indice
 * pesa unos 3 KB (el texto completo son 95 KB, que tambien entraria, pero los
 * titulos alcanzan para decidir cual mirar).
 */

export type CodeArticleIndexEntry = { number: string; title: string };

/** Los articulos del CPU, en el orden del codigo. */
export async function loadCodeIndex(): Promise<CodeArticleIndexEntry[]> {
  const articles = await prisma.normativeArticle.findMany({
    select: { articleNumber: true, title: true },
    orderBy: { displayOrder: "asc" },
    take: 500
  });
  return articles.map((article) => ({
    number: article.articleNumber,
    title: (article.title ?? "").trim()
  }));
}

/** El indice como texto para el prompt. */
export function formatCodeIndex(entries: CodeArticleIndexEntry[]): string {
  return entries.map((entry) => `art. ${entry.number}: ${entry.title}`).join("\n");
}

/**
 * Resuelve los numeros de articulo a sus ids, para poder anclar el cruce.
 * Los numeros que no existen se ignoran: el llamador ya los descarto con aviso.
 */
export async function resolveArticleIds(numbers: string[]): Promise<Map<string, string>> {
  if (!numbers.length) return new Map();
  const articles = await prisma.normativeArticle.findMany({
    where: { articleNumber: { in: numbers } },
    select: { id: true, articleNumber: true }
  });
  return new Map(articles.map((article) => [article.articleNumber, article.id]));
}
