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

// ============================================================================
// Documento comparado: el CPU 2014 completo con el control de cambios de la
// reforma. Rojo = articulo del codigo viejo que alguna norma nueva REEMPLAZA o
// DEROGA (sale de los anclajes de NormativeLink, los mismos que alimentan el
// diagnostico). Verde = las normas nuevas, insertadas despues del articulo que
// reemplazan (o al final si no reemplazan ninguno). La barra de la vista deja
// elegir el PDF: "con cambios" imprime los colores; "limpio" oculta los
// articulos eliminados y saca las marcas — queda el codigo resultante.
// ============================================================================

const COMPARATIVE_STYLES = `
  /* En PANTALLA el documento se presenta como hoja A4: fondo gris, hoja blanca
     centrada con sombra, membrete y pie fluyendo con el contenido. Al imprimir
     rigen los estilos del shell (membrete/pie fijos por pagina). */
  @media screen {
    html { background: #dbe1ea; }
    body { max-width: 210mm; margin: 26px auto 52px; padding: 26px 20mm 30px; background: #ffffff; box-shadow: 0 22px 54px rgba(15, 23, 42, 0.22); border-radius: 4px; }
    .doc-letterhead { position: static; margin-bottom: 24px; }
    .doc-footer { position: static; margin-top: 34px; }
    .doc-watermark { display: none; }
  }
  .portada { padding-top: 6px; }
  .portada h1 { font-size: 26px; line-height: 1.25; margin-bottom: 14px; }
  .portada-metricas { display: flex; gap: 12px; margin: 18px 0; }
  .metrica { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; background: #f8fafc; }
  .metrica strong { display: block; font-size: 26px; line-height: 1.1; }
  .metrica span { font-size: 11.5px; color: #475569; font-weight: 700; }
  .metrica-roja { border-color: #fecaca; background: #fef2f2; } .metrica-roja strong { color: #b91c1c; }
  .metrica-verde { border-color: #bbf7d0; background: #f0fdf4; } .metrica-verde strong { color: #15803d; }
  .indice-cambios { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-top: 16px; }
  .indice-cambios h3 { margin-top: 0; }
  .indice-cambios ul { list-style: none; padding-left: 0; }
  .indice-cambios li { margin: 6px 0; }
  .indice-cambios a { color: #0b1220; text-decoration: none; }
  .indice-cambios a:hover { color: #1f89f6; }
  .indice-verbo { font-weight: 800; font-size: 11px; border-radius: 5px; padding: 1px 6px; margin-right: 6px; }
  .indice-verbo.rojo { background: #fef2f2; color: #b91c1c; }
  .indice-verbo.verde { background: #f0fdf4; color: #15803d; }
  @media print { .portada { page-break-after: always; } .capitulo { page-break-before: always; } }
  .capitulo { margin-top: 30px; }
  .cpu-articulo { border-left: 3px solid #cbd5e1; padding: 2px 0 2px 12px; margin: 14px 0; page-break-inside: avoid; }
  .cpu-articulo h2 { margin: 0 0 4px; font-size: 14px; }
  .cpu-articulo .contenido p { font-size: 12.5px; }
  .cpu-eliminado { border-left-color: #dc2626; background: #fef2f2; }
  .cpu-eliminado h2 { color: #b91c1c; text-decoration: line-through; }
  .badge-cambio { display: inline-block; border-radius: 6px; padding: 1px 8px; font-size: 11px; font-weight: 700; margin-left: 6px; text-decoration: none; }
  .badge-rojo { background: #dc2626; color: #fff; }
  .badge-verde { background: #15803d; color: #fff; }
  .norma-nueva { border-left: 3px solid #15803d; background: #f0fdf4; padding: 6px 12px 10px; margin: 14px 0 14px 18px; page-break-inside: avoid; }
  .norma-nueva h2 { color: #15803d; margin-top: 4px; }
  .referencia-cruzada { font-size: 12px; color: #475569; font-style: italic; margin: 4px 0 4px 18px; }
  .barra-export { position: fixed; top: 14px; right: 14px; z-index: 50; display: flex; flex-direction: column; gap: 6px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); }
  .barra-export button { border: 0; border-radius: 7px; padding: 8px 12px; font-size: 12px; font-weight: 800; cursor: pointer; }
  .barra-export .btn-cambios { background: #1f89f6; color: #fff; }
  .barra-export .btn-limpio { background: #e2e8f0; color: #0b1220; }
  .barra-export p { margin: 0; font-size: 10px; color: #64748b; max-width: 190px; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.limpio .cpu-eliminado, body.limpio .referencia-cruzada, body.limpio .badge-cambio, body.limpio .solo-cambios { display: none; }
  body.limpio .norma-nueva { border-left-color: #cbd5e1; background: transparent; }
  body.limpio .norma-nueva h2 { color: #0b1220; }
  @media print { .barra-export { display: none; } }
`;

type ComparativeCpu = {
  versionLabel: string;
  chapters: Array<{ id: string; number: string; title: string }>;
  articles: Array<{
    id: string;
    number: string;
    title: string;
    content: string;
    chapterId: string | null;
    links: Array<{ sourceType: string; sourceId: string; relationshipType: string }>;
  }>;
};

/**
 * CPU 2014 completo con control de cambios: articulos eliminados en rojo con
 * la norma que los saca, normas nuevas en verde en el lugar del articulo que
 * reemplazan. No imprime solo al cargar (es un documento para LEER); los dos
 * botones de la barra disparan la impresion en el modo elegido.
 */
export function reformToComparativePrintHtml(
  reform: ReformDetail,
  normTexts: Map<string, string | null>,
  cpu: ComparativeCpu
): string {
  const normById = new Map(reform.norms.map((norm) => [norm.id, norm]));

  // Que norma elimina cada articulo, y cual es el PRIMER articulo (en el orden
  // del codigo) que cada norma reemplaza: ahi va su texto completo; en los
  // demas se deja una referencia para no repetir el articulado.
  const eliminadoPor = new Map<string, Array<{ normId: string; relationshipType: string }>>();
  const primerArticuloDeNorma = new Map<string, string>();
  for (const article of cpu.articles) {
    for (const link of article.links) {
      if (link.sourceType !== "project" || !normById.has(link.sourceId)) continue;
      if (link.relationshipType !== "REPLACES" && link.relationshipType !== "REPEALS") continue;
      const lista = eliminadoPor.get(article.id) ?? [];
      lista.push({ normId: link.sourceId, relationshipType: link.relationshipType });
      eliminadoPor.set(article.id, lista);
      if (!primerArticuloDeNorma.has(link.sourceId)) primerArticuloDeNorma.set(link.sourceId, article.id);
    }
  }

  const normaNuevaHtml = (normId: string): string => {
    const norm = normById.get(normId);
    if (!norm) return "";
    return `<section class="norma-nueva"><span class="badge-cambio badge-verde">Artículo nuevo</span>${normSectionHtml(
      { ...norm, articleText: normTexts.get(norm.id) ?? null },
      "h2",
      true
    )}</section>`;
  };

  const articuloHtml = (article: ComparativeCpu["articles"][number]): string => {
    const eliminado = eliminadoPor.get(article.id);
    const bloques: string[] = [];

    if (!eliminado) {
      bloques.push(
        `<section class="cpu-articulo" id="art-${escapeHtml(article.number)}"><h2>Artículo ${escapeHtml(article.number)} — ${escapeHtml(article.title)}</h2><div class="contenido">${toParagraphs(article.content)}</div></section>`
      );
      return bloques.join("");
    }

    const motivos = eliminado
      .map(({ normId, relationshipType }) => {
        const norm = normById.get(normId);
        const verbo = relationshipType === "REPEALS" ? "Derogado" : "Reemplazado";
        return `${verbo} por ${norm ? `${norm.code} — ${norm.title}` : "una norma del código nuevo"}`;
      })
      .map(escapeHtml)
      .join(" · ");

    bloques.push(
      `<section class="cpu-articulo cpu-eliminado" id="art-${escapeHtml(article.number)}"><h2>Artículo ${escapeHtml(article.number)} — ${escapeHtml(article.title)}<span class="badge-cambio badge-rojo">Eliminado</span></h2><p class="muted">${motivos}</p><div class="contenido">${toParagraphs(article.content)}</div></section>`
    );

    // El texto de cada norma va tras SU primer articulo reemplazado.
    for (const { normId } of eliminado) {
      if (primerArticuloDeNorma.get(normId) === article.id) {
        bloques.push(normaNuevaHtml(normId));
      } else {
        const norm = normById.get(normId);
        if (norm) bloques.push(`<p class="referencia-cruzada">El texto de ${escapeHtml(norm.code)} está incluido junto al primer artículo que reemplaza.</p>`);
      }
    }
    return bloques.join("");
  };

  // Normas que no reemplazan ni derogan ningun articulo: son agregados puros.
  const normasSinCorrelato = [...reform.norms]
    .filter((norm) => !primerArticuloDeNorma.has(norm.id))
    .sort((a, b) => compareArticleNumbers(a.articleNumber, b.articleNumber));

  // Portada: la primera impresion es el RESUMEN de la reforma, no una pared de
  // articulado. En pantalla es el primer pantallazo de la hoja; al imprimir se
  // vuelve la primera pagina (page-break-after).
  const eliminadosCount = eliminadoPor.size;
  const indiceEliminados = cpu.articles
    .filter((article) => eliminadoPor.has(article.id))
    .map((article) => {
      const detalle = (eliminadoPor.get(article.id) ?? [])
        .map(({ normId, relationshipType }) => {
          const norm = normById.get(normId);
          return `${relationshipType === "REPEALS" ? "derogado" : "reemplazado"} por ${norm?.code ?? "norma nueva"}`;
        })
        .join(", ");
      return `<li><a href="#art-${escapeHtml(article.number)}"><span class="indice-verbo rojo">Art. ${escapeHtml(article.number)}</span>${escapeHtml(article.title)} <span class="muted">(${escapeHtml(detalle)})</span></a></li>`;
    })
    .join("");

  const header = [
    `<div class="portada">`,
    `<h1>${escapeHtml(reform.title)}<br><span class="muted" style="font-size:16px; font-weight:700;">comparado con el CPU vigente (texto ordenado ${escapeHtml(cpu.versionLabel)})</span></h1>`,
    `<div class="portada-metricas">`,
    `<div class="metrica"><strong>${cpu.articles.length}</strong><span>artículos del código vigente</span></div>`,
    `<div class="metrica metrica-roja"><strong>${eliminadosCount}</strong><span>quedan sin efecto</span></div>`,
    `<div class="metrica metrica-verde"><strong>${reform.norms.length}</strong><span>artículos nuevos</span></div>`,
    `</div>`,
    `<p class="muted">Los artículos en rojo quedan sin efecto según los anclajes cargados en la Fábrica de Normas; el texto que los sustituye aparece en verde a continuación de cada uno. Documento de trabajo para revisión: no es texto vigente.</p>`,
    ...(indiceEliminados
      ? [`<div class="indice-cambios solo-cambios"><h3>Artículos que quedan sin efecto</h3><ul>${indiceEliminados}</ul></div>`]
      : []),
    ...(normasSinCorrelato.length
      ? [`<div class="indice-cambios"><h3>Artículos nuevos sin artículo reemplazado</h3><p class="muted"><a href="#agregados"><span class="indice-verbo verde">${normasSinCorrelato.length}</span>normas que no sustituyen ningún artículo del código vigente — al final del documento.</a></p></div>`]
      : []),
    `</div>`
  ].join("");

  const porCapitulo = cpu.chapters
    .map((chapter) => {
      const articulos = cpu.articles.filter((article) => article.chapterId === chapter.id);
      if (!articulos.length) return "";
      return `<section class="capitulo"><h3>Capítulo ${escapeHtml(chapter.number)} — ${escapeHtml(chapter.title)}</h3>${articulos.map(articuloHtml).join("")}</section>`;
    })
    .join("");
  const sueltos = cpu.articles.filter((article) => !article.chapterId);
  const sinCapitulo = sueltos.length ? `<section class="capitulo"><h3>Artículos sin capítulo</h3>${sueltos.map(articuloHtml).join("")}</section>` : "";

  const agregados = normasSinCorrelato.length
    ? `<section class="capitulo" id="agregados"><h3>Artículos nuevos sin artículo reemplazado</h3>${normasSinCorrelato.map((norm) => normaNuevaHtml(norm.id)).join("")}</section>`
    : "";

  const barra = [
    `<div class="barra-export">`,
    `<button type="button" class="btn-cambios" onclick="document.body.classList.remove('limpio'); window.print();">Guardar PDF con cambios</button>`,
    `<button type="button" class="btn-limpio" onclick="document.body.classList.add('limpio'); window.print();">Guardar PDF limpio</button>`,
    `<p>El PDF limpio oculta los artículos eliminados y las marcas: queda el código resultante.</p>`,
    `</div>`
  ].join("");

  const documento = printDocument(`${reform.code} — comparado con CPU ${cpu.versionLabel}`, header + porCapitulo + sinCapitulo + agregados, {
    subtitle: "Fábrica de Normas · Documento comparado",
    docCode: reform.code,
    statusLabel: reformStatusLabels[reform.status]
  });

  // printDocument autoimprime al cargar (sirve para los export directos); aca
  // el documento es para revisar primero, asi que se quita ese script y se
  // inyectan la barra y los estilos del comparado.
  return documento
    .replace(`<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>`, barra)
    .replace("</style>", `${COMPARATIVE_STYLES}</style>`);
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
