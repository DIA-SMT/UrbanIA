import "server-only";

import {
  DOCUMENT_SHELL_STYLES,
  renderFooter,
  renderLetterhead,
  renderWatermark,
  type LetterheadMeta
} from "@/lib/brand/document-shell";
import type { NormDetail, NormListItem, ReformDetail } from "@/lib/projects/shared";
import {
  conflictLevelLabels,
  materiaLabels,
  normStatusLabels,
  reformStatusLabels,
  relationshipTypeLabels
} from "@/lib/projects/shared";

/**
 * Export en PDF de la Fabrica de Normas, con el patron del repo (sin
 * dependencias): la ruta devuelve HTML imprimible con identidad municipal
 * (membrete, marca de agua y pie institucional) que dispara el dialogo de
 * impresion del navegador ("Guardar como PDF").
 */

/** Orden numerico-consciente: "2" antes que "10"; sin numero, al final. */
export function compareArticleNumbers(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const numA = Number.parseFloat(a);
  const numB = Number.parseFloat(b);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
  return a.localeCompare(b, "es", { numeric: true });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

/** Texto multilinea a parrafos HTML seguros. */
function toParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0b1220; line-height: 1.55; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 6px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #1f89f6; margin: 18px 0 6px; }
  p { margin: 6px 0; font-size: 13px; }
  .muted { color: #475569; font-size: 12px; }
  .article-text { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc; }
  .article-text p { font-size: 13px; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { margin: 3px 0; font-size: 13px; }
  .norm { page-break-inside: avoid; border-top: 2px solid #1f89f6; margin-top: 26px; padding-top: 10px; }
`;

/**
 * Arma el documento imprimible con el shell institucional: marca de agua,
 * membrete y pie repetidos por pagina, y el cuerpo con espacio reservado.
 */
function printDocument(title: string, bodyHtml: string, meta: LetterheadMeta): string {
  return [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}${DOCUMENT_SHELL_STYLES}</style></head><body>`,
    renderWatermark(),
    renderLetterhead(meta),
    `<main class="doc-body">${bodyHtml}</main>`,
    renderFooter({ docCode: meta.docCode }),
    `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>`,
    "</body></html>"
  ].join("");
}

function normHeading(norm: Pick<NormListItem, "articleNumber" | "title">): string {
  return norm.articleNumber ? `Artículo ${norm.articleNumber} — ${norm.title}` : norm.title;
}

/**
 * Linea de metadatos de una norma. `includeIdentity` agrega codigo y estado:
 * va en las secciones del codigo consolidado, pero no en el documento de una
 * norma sola (ahi ya lo muestra el membrete).
 */
function normMetaLine(norm: NormListItem, includeIdentity: boolean): string {
  const materia = norm.areas.map((area) => materiaLabels[area]).join(", ");
  const parts = [
    ...(includeIdentity ? [norm.code, normStatusLabels[norm.status]] : []),
    ...(materia ? [materia] : []),
    ...(norm.latestFeasibility ? [`Último análisis: ${conflictLevelLabels[norm.latestFeasibility]}`] : [])
  ];
  return parts.map(escapeHtml).join(" · ");
}

function normSectionHtml(
  norm: NormListItem & { articleText?: string | null },
  headingTag: "h1" | "h2",
  includeIdentity: boolean
): string {
  const articleBlock = norm.articleText?.trim()
    ? `<div class="article-text">${toParagraphs(norm.articleText)}</div>`
    : `<p class="muted">Sin texto redactado todavía.</p>`;

  const metaLine = normMetaLine(norm, includeIdentity);

  return [
    `<${headingTag}>${escapeHtml(normHeading(norm))}</${headingTag}>`,
    ...(metaLine ? [`<p class="muted">${metaLine}</p>`] : []),
    `<h3>Objeto</h3>${toParagraphs(norm.summary)}`,
    `<h3>Texto del articulado</h3>${articleBlock}`
  ].join("");
}

/** Codigo nuevo consolidado: todas sus normas ordenadas por articleNumber. */
export function reformToPrintHtml(reform: ReformDetail, normTexts: Map<string, string | null>): string {
  const sorted = [...reform.norms].sort((a, b) => compareArticleNumbers(a.articleNumber, b.articleNumber));

  const header = [
    `<h1>${escapeHtml(reform.title)}</h1>`,
    `<p class="muted">${reform.normCount} ${reform.normCount === 1 ? "norma" : "normas"} · Borrador para elevar a ordenanza</p>`,
    ...(reform.description ? [toParagraphs(reform.description)] : [])
  ].join("");

  const body = sorted
    .map((norm) => `<section class="norm">${normSectionHtml({ ...norm, articleText: normTexts.get(norm.id) ?? null }, "h2", true)}</section>`)
    .join("");

  return printDocument(`${reform.code} — ${reform.title}`, header + body, {
    subtitle: "Fábrica de Normas · Código nuevo",
    docCode: reform.code,
    statusLabel: reformStatusLabels[reform.status]
  });
}

/** Una norma individual, con sus articulos del CPU 2014 relacionados. */
export function normToPrintHtml(norm: NormDetail): string {
  const anchorsBlock = norm.anchors.length
    ? [
        `<h3>Artículos del CPU 2014 relacionados</h3>`,
        "<ul>",
        ...norm.anchors.map(
          (anchor) =>
            `<li><strong>${escapeHtml(relationshipTypeLabels[anchor.relationshipType])}</strong> · Artículo ${escapeHtml(anchor.articleNumber)} (${escapeHtml(anchor.articleTitle)})${anchor.notes ? ` — ${escapeHtml(anchor.notes)}` : ""}</li>`
        ),
        "</ul>"
      ].join("")
    : "";

  return printDocument(`${norm.code} — ${norm.title}`, normSectionHtml(norm, "h1", false) + anchorsBlock, {
    subtitle: norm.reformTitle ? `Fábrica de Normas · ${norm.reformTitle}` : "Fábrica de Normas",
    docCode: norm.code,
    statusLabel: normStatusLabels[norm.status]
  });
}
