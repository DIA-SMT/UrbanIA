import "server-only";

import { prisma } from "@/lib/db/prisma";
import { CROSS_RELATIONSHIP_LABELS, type CrossRelationship } from "@/lib/normas/analyze-document";
import type {
  HearingSummaryMaterial,
  SummaryArticleImpact,
  SummaryArticleRef,
  SummaryPresenter,
  SummaryProposal
} from "@/lib/hearings/summary-document";

/**
 * Lo que se presentó EN una audiencia, listo para el resumen ejecutivo.
 *
 * Estos datos NO los redacta el modelo: salen del análisis que ya se hizo sobre
 * cada PDF y que ya fue verificado (la cita se comprobó contra el texto real, y
 * los artículos contra el índice del Código). Pedirle al modelo que vuelva a
 * leer los PDF para contar quién propuso qué sería más caro, más lento y --lo
 * que importa-- reabriría la puerta a que invente nombres de organizaciones y
 * citas en un documento con membrete municipal.
 *
 * El modelo sigue haciendo lo que hace bien: redactar la narrativa de lo que
 * pasó en la sala. Los hechos duros van por acá.
 */

/** Los tipos de documento del análisis, en castellano. */
const DOCUMENT_KIND_LABELS: Record<string, string> = {
  PROPUESTA_NORMATIVA: "Propuesta normativa",
  DIAGNOSTICO_TECNICO: "Diagnóstico técnico",
  PRESENTACION_INSTITUCIONAL: "Presentación institucional",
  PONENCIA_ACADEMICA: "Ponencia académica",
  OTRO: "Otro"
};

/**
 * Nombre de quien expuso.
 *
 * Si el análisis no detectó la organización, se cae al nombre del archivo antes
 * que a un "Sin identificar": el archivo suele decir de quién es ("PRESENTACION
 * CAT AUDIENCIA"), y un documento público que no puede nombrar a quien expuso es
 * peor que uno que lo nombra por su documento.
 */
function presenterName(organization: string | null, fileName: string): string {
  const clean = (organization ?? "").trim();
  if (clean) return clean;
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Documento sin identificar";
}

function relationLabel(value: string): string {
  return CROSS_RELATIONSHIP_LABELS[value as CrossRelationship] ?? "Se relaciona con";
}

/** Lee el cruce guardado en la columna Json, descartando lo que no tenga forma. */
function readCross(raw: unknown): Array<{ proposalTitle: string; articles: SummaryArticleRef[] }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const articles = Array.isArray(item.articles)
      ? item.articles.flatMap((article) => {
          if (!article || typeof article !== "object") return [];
          const value = article as Record<string, unknown>;
          if (typeof value.number !== "string" || typeof value.relationship !== "string") return [];
          return [
            {
              numero: value.number,
              titulo: "",
              relacion: relationLabel(value.relationship),
              porQue: typeof value.why === "string" ? value.why : ""
            }
          ];
        })
      : [];
    if (!articles.length) return [];
    return [{ proposalTitle: typeof item.proposalTitle === "string" ? item.proposalTitle : "", articles }];
  });
}

/**
 * Junta el material presentado en una audiencia.
 *
 * Las propuestas salen de las NORMAS que se fabricaron a partir de cada PDF (que
 * es lo que una persona revisó y aceptó), no de la lista cruda del análisis: si
 * alguien la descartó en la revisión, no tiene por qué reaparecer en un
 * documento institucional.
 */
export async function loadHearingSummaryMaterial(meetingId: string): Promise<HearingSummaryMaterial> {
  const vacio: HearingSummaryMaterial = { expositores: [], propuestas: [], impacto: [] };
  if (!process.env.DATABASE_URL) return vacio;

  const documents = await prisma.reformDocument.findMany({
    where: { meetingId },
    orderBy: { uploadedAt: "asc" },
    select: {
      name: true,
      storagePath: true,
      summary: true,
      documentKind: true,
      organization: true,
      crossReferences: true
    }
  });
  if (!documents.length) return vacio;

  // Las normas que salieron de cada PDF se atan por storagePath: el adjunto de
  // cada norma apunta al MISMO objeto del bucket que el documento (ver el
  // comentario de ProjectAttachment.storagePath en el esquema).
  const paths = documents.map((document) => document.storagePath).filter((path): path is string => Boolean(path));
  const attachments = paths.length
    ? await prisma.projectAttachment.findMany({
        where: { storagePath: { in: paths } },
        orderBy: { createdAt: "asc" },
        select: {
          storagePath: true,
          excerpt: true,
          sourcePages: true,
          project: { select: { title: true, summary: true } }
        }
      })
    : [];

  const expositores: SummaryPresenter[] = [];
  const propuestas: SummaryProposal[] = [];
  const impactoPorArticulo = new Map<string, SummaryArticleImpact>();

  for (const document of documents) {
    const quien = presenterName(document.organization, document.name);
    const cruces = readCross(document.crossReferences);
    const propias = attachments.filter((attachment) => attachment.storagePath === document.storagePath);

    for (const attachment of propias) {
      const titulo = attachment.project?.title?.trim() ?? "";
      if (!titulo) continue;
      // El cruce se guardó por título de propuesta: es lo que los une.
      const articulos = cruces.find((entry) => entry.proposalTitle === titulo)?.articles ?? [];
      propuestas.push({
        organizacion: quien,
        documento: document.name,
        titulo,
        resumen: attachment.project?.summary?.trim() ?? "",
        cita: attachment.excerpt?.trim() ?? "",
        paginas: attachment.sourcePages ?? [],
        articulos
      });

      for (const articulo of articulos) {
        const actual = impactoPorArticulo.get(articulo.numero) ?? { numero: articulo.numero, titulo: "", propuestas: [] };
        actual.propuestas.push({ organizacion: quien, titulo, relacion: articulo.relacion });
        impactoPorArticulo.set(articulo.numero, actual);
      }
    }

    expositores.push({
      organizacion: quien,
      documento: document.name,
      queTrajo: document.summary?.trim() ?? "",
      tipo: document.documentKind ? (DOCUMENT_KIND_LABELS[document.documentKind] ?? null) : null,
      propuestas: propias.length
    });
  }

  // El título de cada artículo, para no mostrar un número pelado. Se busca sobre
  // el Código vigente; los artículos que el cruce nombró pero no existen en la
  // base quedan sin título en vez de desaparecer.
  const numeros = [...impactoPorArticulo.keys()];
  if (numeros.length) {
    const articles = await prisma.normativeArticle.findMany({
      where: { articleNumber: { in: numeros } },
      select: { articleNumber: true, title: true }
    });
    const titulos = new Map(articles.map((article) => [article.articleNumber, (article.title ?? "").trim()]));
    for (const [numero, entry] of impactoPorArticulo) {
      entry.titulo = titulos.get(numero) ?? "";
    }
    for (const proposal of propuestas) {
      for (const articulo of proposal.articulos) {
        articulo.titulo = titulos.get(articulo.numero) ?? "";
      }
    }
  }

  // Primero los artículos con más demanda: es la lectura que importa.
  const impacto = [...impactoPorArticulo.values()].sort(
    (a, b) => b.propuestas.length - a.propuestas.length || Number(a.numero) - Number(b.numero)
  );

  return { expositores, propuestas, impacto };
}

/**
 * El material como texto, para darle contexto al redactor del resumen.
 *
 * No es para que lo copie: es para que NO lo repita y no lo contradiga. Las
 * páginas de "quiénes expusieron" y "qué propuso cada una" ya están escritas
 * cuando el modelo redacta, así que su trabajo es el debate de la sala.
 */
export function formatSummaryMaterial(material: HearingSummaryMaterial): string {
  if (!material.expositores.length) return "";
  const bloques: string[] = [
    [
      "=== LO YA REGISTRADO EN EL DOCUMENTO (dato verificado: NO lo redactes de nuevo) ===",
      "Estas páginas ya existen en el resumen y salen del expediente. Usalas como contexto para saber de qué se habló y quién lo trajo, pero no las repitas: tu trabajo es el debate, las tensiones y lo que no figura en ningún documento.",
      "",
      "QUIÉNES EXPUSIERON:",
      ...material.expositores.map(
        (presenter) =>
          `- ${presenter.organizacion} — ${presenter.documento}${
            presenter.propuestas ? ` (${presenter.propuestas} propuestas)` : " (sin propuestas normativas)"
          }${presenter.queTrajo ? `\n  ${presenter.queTrajo}` : ""}`
      )
    ].join("\n")
  ];

  if (material.propuestas.length) {
    bloques.push(
      [
        "PROPUESTAS PRESENTADAS:",
        ...material.propuestas.map((proposal) =>
          [
            `- [${proposal.organizacion}] ${proposal.titulo}`,
            proposal.resumen ? `  ${proposal.resumen}` : "",
            proposal.articulos.length
              ? `  Toca: ${proposal.articulos.map((article) => `art. ${article.numero} (${article.relacion})`).join(", ")}`
              : "  No toca ningún artículo del Código vigente."
          ]
            .filter(Boolean)
            .join("\n")
        )
      ].join("\n")
    );
  }

  if (material.impacto.length) {
    bloques.push(
      [
        "ARTÍCULOS DEL CÓDIGO MÁS ALCANZADOS:",
        ...material.impacto
          .slice(0, 10)
          .map(
            (articulo) =>
              `- Art. ${articulo.numero}${articulo.titulo ? ` (${articulo.titulo})` : ""}: ${articulo.propuestas.length} propuestas de ${
                [...new Set(articulo.propuestas.map((item) => item.organizacion))].join(", ")
              }`
          )
      ].join("\n")
    );
  }

  return bloques.join("\n\n");
}
