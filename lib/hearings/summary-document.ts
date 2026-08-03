/**
 * Documento institucional de cuatro páginas para el resumen ejecutivo de una
 * audiencia. No importa módulos de servidor: recibe los logos ya embebidos y
 * también puede renderizarse desde scripts de control visual.
 */

export type SummaryBlock = {
  titulo: string;
  parrafos: string[];
  destacados?: string[];
  datos?: { valor: string; descripcion: string }[];
  tabla?: { titulo?: string; columnas: string[]; filas: string[][] };
};

export type SummarySection = SummaryBlock & {
  subsecciones?: SummaryBlock[];
};

export type SummaryPayload = {
  titulo: string;
  bajada: string;
  deQueSeTrata: string;
  expositor: string;
  destinatario: string;
  estructura: string;
  secciones: SummarySection[];
  lineasDeAccion: string[];
  enSintesis: string;
};

export type InstitutionalSummaryOptions = {
  hearingTitle: string;
  when: string;
  docCode: string;
  monthYear: string;
  sourceSummary: string;
  municipalHeaderLogo: string;
  municipalFooterLogo: string;
  diaLogo: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/[–—‑]/g, "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clampText(value: string, maxLength: number): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"));
  if (sentenceEnd >= Math.floor(maxLength * 0.55)) return clipped.slice(0, sentenceEnd + 1);
  const wordEnd = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(wordEnd, maxLength - 20)).trim()}...`;
}

function firstSentence(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return clampText(match?.[0] ?? clean, 155);
}

function renderLogo(src: string | null | undefined, className: string, alt: string): string {
  return src ? `<img class="${className}" src="${src}" alt="${escapeHtml(alt)}">` : "";
}

function renderSectionHeading(title: string, kicker?: string): string {
  return [
    `<div class="section-heading">`,
    kicker ? `<span>${escapeHtml(kicker)}</span>` : "",
    `<h2>${escapeHtml(title)}</h2>`,
    `</div>`
  ].join("");
}

function renderFooter(page: number, total: number, options: InstitutionalSummaryOptions): string {
  const municipal = [
    `<div class="footer-brand footer-municipal">`,
    renderLogo(options.municipalFooterLogo, "footer-municipal-logo", "Municipalidad de San Miguel de Tucumán"),
    `<div><strong>Municipalidad de San Miguel de Tucumán</strong><small>UrbanIA | Audiencias públicas</small></div>`,
    `</div>`
  ].join("");
  const dia = [
    `<div class="footer-brand footer-dia">`,
    renderLogo(options.diaLogo, "footer-dia-logo", "Dirección de Inteligencia Artificial"),
    `<div><strong>Dirección de Inteligencia Artificial</strong><small>Área desarrolladora</small></div>`,
    `</div>`
  ].join("");
  const municipalAttribution = `Municipalidad SMT | ${escapeHtml(options.monthYear)} | Página ${page} de ${total}`;
  const diaAttribution = `Desarrollado por Dirección de IA | ${escapeHtml(options.monthYear)} | Página ${page} de ${total}`;
  const odd = page % 2 === 1;

  return [
    `<footer class="institutional-footer">`,
    odd ? municipal : dia,
    `<div class="footer-attribution">${odd ? diaAttribution : municipalAttribution}<small>${escapeHtml(options.docCode)} | Documento de trabajo</small></div>`,
    `</footer>`
  ].join("");
}

function renderContinuationHeader(title: string, options: InstitutionalSummaryOptions): string {
  return [
    `<header class="continuation-header">`,
    `<div class="continuation-title"><span>${escapeHtml(title)}</span>${renderLogo(
      options.municipalHeaderLogo,
      "continuation-logo",
      "Ciudad de San Miguel de Tucumán"
    )}</div>`,
    `<div class="institutional-rule"><i></i><b></b></div>`,
    `</header>`
  ].join("");
}

function renderDataCards(data?: { valor: string; descripcion: string }[]): string {
  if (!data?.length) return "";
  return `<div class="summary-data">${data
    .slice(0, 2)
    .map(
      (item) =>
        `<div class="summary-data-card"><strong>${escapeHtml(item.valor)}</strong><span>${escapeHtml(clampText(item.descripcion, 120))}</span></div>`
    )
    .join("")}</div>`;
}

function renderSummarySection(section: SummarySection, index: number): string {
  const paragraphs = section.parrafos
    .slice(0, 2)
    .map((paragraph) => `<p>${escapeHtml(clampText(paragraph, 560))}</p>`)
    .join("");
  const highlight = section.destacados?.[0]
    ? `<blockquote>${escapeHtml(clampText(section.destacados[0], 240))}</blockquote>`
    : "";

  return [
    `<section class="summary-section">`,
    renderSectionHeading(section.titulo, `0${index + 1}`),
    paragraphs,
    renderDataCards(section.datos),
    highlight,
    `</section>`
  ].join("");
}

function renderPageOne(payload: SummaryPayload, options: InstitutionalSummaryOptions, total: number): string {
  const titleLength = Array.from(payload.titulo.trim()).length;
  const titleClass = titleLength > 72 ? " title-long" : titleLength > 52 ? " title-medium" : "";
  const contentCards = payload.secciones
    .slice(0, 4)
    .map((section, index) => {
      const detail = section.parrafos[0] ? firstSentence(section.parrafos[0]) : "Contenido verificado en el material de la audiencia.";
      return [
        `<article class="content-card accent-${index + 1}">`,
        `<span>0${index + 1}</span>`,
        `<div><h3>${escapeHtml(section.titulo)}</h3><p>${escapeHtml(detail)}</p></div>`,
        `</article>`
      ].join("");
    })
    .join("");

  const steps = [
    ["1", "Fuentes", "Reúne la transcripción y los documentos incorporados."],
    ["2", "Evidencia", "Identifica hechos, cifras, referencias y posiciones expresas."],
    ["3", "Síntesis", "Ordena los hallazgos por impacto ciudadano y municipal."],
    ["4", "Validación", "El equipo municipal revisa el borrador antes de circularlo."]
  ];

  return [
    `<section class="pdf-page cover-page">`,
    `<header class="cover-header">`,
    `<div class="cover-topline">`,
    renderLogo(options.municipalHeaderLogo, "cover-municipal-logo", "Ciudad de San Miguel de Tucumán"),
    `<div class="dia-pill">${renderLogo(options.diaLogo, "dia-pill-logo", "Dirección de Inteligencia Artificial")}<small>DESARROLLO</small></div>`,
    `</div>`,
    `<div class="cover-title${titleClass}">`,
    `<h1>${escapeHtml(payload.titulo)}</h1>`,
    `<p>${escapeHtml(clampText(payload.bajada, 210))}</p>`,
    `</div>`,
    `<div class="institutional-rule"><i></i><b></b></div>`,
    `</header>`,
    `<main class="cover-body">`,
    `<section class="about-section">`,
    renderSectionHeading("De qué se trata"),
    `<p>${escapeHtml(clampText(payload.deQueSeTrata, 720))}</p>`,
    `<div class="context-grid">`,
    `<div><span>Audiencia</span><strong>${escapeHtml(clampText(options.hearingTitle, 80))}</strong><small>${escapeHtml(options.when)}</small></div>`,
    `<div><span>Expositor</span><strong>${escapeHtml(clampText(payload.expositor, 80))}</strong><small>Identificación según el material</small></div>`,
    `<div><span>Destinatario</span><strong>${escapeHtml(clampText(payload.destinatario, 80))}</strong><small>Ámbito de decisión</small></div>`,
    `</div>`,
    `</section>`,
    `<section class="process-section">`,
    renderSectionHeading("Cómo funciona este resumen"),
    `<div class="process-flow">${steps
      .map(
        ([number, title, detail]) =>
          `<article><i>${number}</i><div><strong>${title}</strong><p>${detail}</p></div></article>`
      )
      .join("")}</div>`,
    `</section>`,
    `<section class="contents-section">`,
    renderSectionHeading("Qué contiene"),
    `<div class="content-grid">${contentCards}</div>`,
    `</section>`,
    `</main>`,
    renderFooter(1, total, options),
    `</section>`
  ].join("");
}

function renderSectionsPage(
  payload: SummaryPayload,
  options: InstitutionalSummaryOptions,
  page: number,
  title: string,
  startIndex: number,
  total: number
): string {
  const sections = payload.secciones
    .slice(startIndex, startIndex + 2)
    .map((section, offset) => renderSummarySection(section, startIndex + offset))
    .join("");

  return [
    `<section class="pdf-page continuation-page page-${page}">`,
    renderContinuationHeader(title, options),
    `<main class="continuation-body">${sections}</main>`,
    renderFooter(page, total, options),
    `</section>`
  ].join("");
}

function renderClosingPage(payload: SummaryPayload, options: InstitutionalSummaryOptions, total: number): string {
  const actions = payload.lineasDeAccion
    .slice(0, 5)
    .map((action, index) => `<li><i>${index + 1}</i><p>${escapeHtml(clampText(action, 260))}</p></li>`)
    .join("");

  return [
    `<section class="pdf-page continuation-page closing-page">`,
    renderContinuationHeader("Prioridades y cierre", options),
    `<main class="continuation-body closing-body">`,
    `<section>`,
    renderSectionHeading("Líneas de acción", "AGENDA"),
    `<p class="section-intro">Medidas y decisiones que surgen del material analizado. Su implementación y alcance deben ser validados por las áreas municipales competentes.</p>`,
    `<ol class="action-list">${actions}</ol>`,
    `</section>`,
    `<section class="traceability-card">`,
    `<div><span>Origen</span><strong>${escapeHtml(clampText(options.hearingTitle, 95))}</strong></div>`,
    `<div><span>Fuentes analizadas</span><strong>${escapeHtml(clampText(options.sourceSummary, 180))}</strong></div>`,
    `<div><span>Carácter</span><strong>Borrador sujeto a revisión municipal</strong></div>`,
    `</section>`,
    `<section class="synthesis-block">`,
    `<span>En síntesis</span>`,
    `<p>${escapeHtml(clampText(payload.enSintesis, 620))}</p>`,
    `<small>La IA orienta; el equipo municipal revisa, redacta y valida.</small>`,
    `</section>`,
    `</main>`,
    renderFooter(4, total, options),
    `</section>`
  ].join("");
}

export const INSTITUTIONAL_SUMMARY_STYLES = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #33414f; }
  .pdf-document { width: 210mm; margin: 0 auto; }
  .pdf-page {
    position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #ffffff;
    page-break-after: always; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .pdf-page:last-child { page-break-after: auto; break-after: auto; }
  .institutional-rule { position: absolute; right: 0; bottom: 0; left: 0; display: flex; height: 2.6mm; }
  .institutional-rule i { width: 22%; background: #F2D91C; }
  .institutional-rule b { flex: 1; background: #3cb4f0; }

  .cover-header { position: relative; height: 53mm; padding: 11mm 14mm 0; color: #ffffff; background: radial-gradient(120% 150% at 88% 8%, rgba(60, 180, 240, 0.42), transparent 58%), linear-gradient(112deg, #0d3fb0 0%, #126ff5 52%, #2589ea 100%); }
  .cover-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .cover-municipal-logo { width: auto; max-width: 48mm; height: 11mm; object-fit: contain; object-position: left top; }
  .dia-pill { display: flex; min-width: 38mm; min-height: 12mm; flex-direction: column; align-items: center; justify-content: center; border-radius: 3mm; padding: 2.1mm 4mm 1.8mm; background: #ffffff; box-shadow: 0 3mm 8mm rgba(4, 26, 66, 0.26); }
  .dia-pill-logo { width: auto; max-width: 29mm; height: 6.4mm; object-fit: contain; }
  .dia-pill small { display: block; margin-top: 0.8mm; color: #8a949e; font-size: 5.2pt; line-height: 1; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .cover-title { position: absolute; right: 14mm; bottom: 5.2mm; left: 14mm; max-width: 164mm; }
  .cover-title h1 { margin: 0; color: #ffffff; font-size: 25pt; line-height: 0.96; font-weight: 800; letter-spacing: -0.55pt; }
  .cover-title.title-medium h1 { font-size: 23pt; line-height: 0.99; }
  .cover-title.title-long h1 { font-size: 20.5pt; line-height: 1.02; }
  .cover-title p { max-width: 160mm; margin: 1mm 0 0; color: #cceeff; font-size: 8.2pt; line-height: 1.18; }

  .cover-body { display: flex; height: 229mm; flex-direction: column; padding: 6.5mm 14mm 18mm; }
  .section-heading { position: relative; min-height: 8mm; margin-bottom: 2.5mm; padding-left: 4mm; }
  .section-heading::before { position: absolute; top: 0.4mm; bottom: 0.4mm; left: 0; width: 1.5mm; border-radius: 1mm; content: ""; background: linear-gradient(180deg, #126ff5, #3cb4f0); }
  .section-heading span { display: block; margin-bottom: 0.5mm; color: #2589ea; font-size: 6.6pt; font-weight: 800; letter-spacing: 1.4pt; text-transform: uppercase; }
  .section-heading h2 { margin: 0; color: #10233d; font-size: 14.5pt; line-height: 1.15; font-weight: 800; letter-spacing: -0.2pt; }
  .about-section > p { margin: 0; color: #33414f; font-size: 9.1pt; line-height: 1.48; }
  .context-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 2.5mm; margin-top: 3mm; }
  .context-grid > div { min-height: 16mm; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 2.3mm 3mm; background: #fbfcfe; }
  .context-grid span, .context-grid strong, .context-grid small { display: block; }
  .context-grid span { color: #2589ea; font-size: 6.2pt; font-weight: 800; letter-spacing: 1pt; text-transform: uppercase; }
  .context-grid strong { margin-top: 0.8mm; color: #10233d; font-size: 8pt; line-height: 1.2; font-weight: 700; }
  .context-grid small { margin-top: 0.7mm; color: #6b7885; font-size: 6.6pt; line-height: 1.25; }
  .process-section { margin-top: 6mm; }
  .process-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 0.35mm solid #d8e6fa; border-radius: 3.4mm; padding: 4mm 3mm; background: linear-gradient(180deg, #f6faff, #eef6ff); }
  .process-flow article { position: relative; min-width: 0; padding: 0 2.2mm; text-align: center; }
  .process-flow article:not(:last-child)::after { position: absolute; top: 5.8mm; right: -1.5mm; color: #b9cfe8; content: "›"; font-size: 13pt; font-weight: 400; }
  .process-flow article > i { display: grid; width: 15mm; height: 15mm; margin: 0 auto 2.2mm; place-items: center; border-radius: 50%; color: #ffffff; background: linear-gradient(140deg, #25d366, #1aa851); box-shadow: 0 2.4mm 5mm rgba(26, 168, 81, 0.3); font-size: 11pt; font-style: normal; font-weight: 800; }
  .process-flow article:nth-child(2) > i { background: linear-gradient(140deg, #126ff5, #28469f); box-shadow: 0 2.4mm 5mm rgba(18, 111, 245, 0.28); }
  .process-flow article:nth-child(3) > i { background: linear-gradient(140deg, #3cb4f0, #2589ea); box-shadow: 0 2.4mm 5mm rgba(18, 111, 245, 0.24); }
  .process-flow article:nth-child(4) > i { color: #10233d; background: linear-gradient(140deg, #F2D91C, #f5b81c); box-shadow: 0 2.4mm 5mm rgba(239, 143, 22, 0.3); }
  .process-flow strong { color: #10233d; font-size: 8.1pt; font-weight: 800; }
  .process-flow p { margin: 0.8mm auto 0; color: #6b7885; font-size: 6.8pt; line-height: 1.35; }
  .contents-section { display: flex; min-height: 0; flex: 1; flex-direction: column; margin-top: 6mm; }
  .content-grid { display: grid; min-height: 0; flex: 1; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, 1fr); gap: 2.5mm; }
  .content-card { display: grid; min-height: 25mm; grid-template-columns: 8mm 1fr; gap: 2.2mm; align-items: center; border: 0.35mm solid #e3e8ef; border-left-width: 1.5mm; border-radius: 2.6mm; padding: 3mm 3.4mm; background: #ffffff; box-shadow: 0 1.5mm 4mm rgba(16, 35, 61, 0.06); }
  .content-card > span { color: #2589ea; font-size: 7pt; font-weight: 800; }
  .content-card h3 { margin: 0; color: #10233d; font-size: 8.6pt; line-height: 1.15; font-weight: 800; }
  .content-card p { margin: 1mm 0 0; color: #6b7885; font-size: 6.8pt; line-height: 1.32; }
  .content-card.accent-1 { border-left-color: #126ff5; }
  .content-card.accent-2 { border-left-color: #3cb4f0; }
  .content-card.accent-3 { border-left-color: #10b981; }
  .content-card.accent-4 { border-left-color: #f5b81c; }

  .continuation-header { position: relative; height: 20mm; overflow: hidden; color: #ffffff; background: linear-gradient(90deg, #F2D91C 0 22%, #3cb4f0 22%) bottom / 100% 1.6mm no-repeat, linear-gradient(112deg, #0d3fb0, #126ff5 62%, #2589ea); }
  .continuation-header > .institutional-rule { display: none; }
  .continuation-title { position: absolute; top: 4mm; right: 14mm; left: 14mm; z-index: 1; display: flex; height: 9mm; align-items: center; justify-content: space-between; gap: 8mm; }
  .continuation-title span { color: #ffffff; font-size: 13pt; line-height: 1; font-weight: 800; letter-spacing: -0.1pt; }
  .continuation-logo { width: auto; max-width: 47mm; height: 7.6mm; flex: 0 0 auto; object-fit: contain; object-position: right center; }
  .continuation-body { height: 262mm; padding: 8mm 14mm 19mm; }
  .summary-section { min-height: 111mm; padding: 1mm 0 5mm; }
  .summary-section + .summary-section { border-top: 0.35mm solid #e3e8ef; padding-top: 6mm; }
  .summary-section > p { margin: 2.4mm 0 0; color: #33414f; font-size: 10.2pt; line-height: 1.55; }
  .summary-section blockquote { margin: 3.2mm 0 0; border-left: 1.5mm solid #3cb4f0; border-radius: 0 2.6mm 2.6mm 0; padding: 2.5mm 3.5mm; color: #28469f; background: #eef7ff; font-size: 9.2pt; line-height: 1.4; font-style: italic; }
  .summary-data { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5mm; margin-top: 3mm; }
  .summary-data-card { border: 0.35mm solid #dce7f3; border-radius: 2.6mm; padding: 2.6mm 3mm; background: #fbfcfe; }
  .summary-data-card strong, .summary-data-card span { display: block; }
  .summary-data-card strong { color: #126ff5; font-size: 14pt; line-height: 1; font-weight: 800; }
  .summary-data-card span { margin-top: 1mm; color: #6b7885; font-size: 7.4pt; line-height: 1.3; }

  .closing-body { display: flex; flex-direction: column; }
  .section-intro { max-width: 165mm; margin: 0 0 4mm; color: #6b7885; font-size: 9.4pt; line-height: 1.5; }
  .action-list { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 0; padding: 0; list-style: none; }
  .action-list li { display: grid; min-height: 28mm; grid-template-columns: 10mm 1fr; gap: 2.5mm; align-items: start; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 3mm; background: #fbfcfe; }
  .action-list li:last-child:nth-child(odd) { grid-column: 1 / -1; min-height: 22mm; }
  .action-list i { display: grid; width: 8mm; height: 8mm; place-items: center; border-radius: 50%; color: #ffffff; background: #126ff5; font-size: 8pt; font-style: normal; font-weight: 800; }
  .action-list p { margin: 0; color: #33414f; font-size: 9pt; line-height: 1.45; }
  .traceability-card { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 3mm; margin-top: 6mm; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 3.2mm 3.5mm; background: #ffffff; }
  .traceability-card span, .traceability-card strong { display: block; }
  .traceability-card span { color: #2589ea; font-size: 6.3pt; font-weight: 800; letter-spacing: 1pt; text-transform: uppercase; }
  .traceability-card strong { margin-top: 1mm; color: #10233d; font-size: 7.8pt; line-height: 1.3; font-weight: 700; }
  .synthesis-block { margin-top: auto; border-radius: 3mm; padding: 6mm 7mm; color: #ffffff; background: linear-gradient(112deg, #0d3fb0, #126ff5 65%, #2589ea); box-shadow: 0 2mm 6mm rgba(13, 63, 176, 0.18); }
  .synthesis-block > span { display: block; color: #cceeff; font-size: 7pt; font-weight: 800; letter-spacing: 1.6pt; text-transform: uppercase; }
  .synthesis-block p { margin: 2mm 0 0; color: #ffffff; font-size: 12.5pt; line-height: 1.5; font-weight: 700; }
  .synthesis-block small { display: block; margin-top: 3mm; color: #d8f2ff; font-size: 7pt; }

  .institutional-footer { position: absolute; right: 0; bottom: 0; left: 0; display: flex; height: 15mm; align-items: center; justify-content: space-between; gap: 8mm; border-top: 0.35mm solid #e3e8ef; padding: 2mm 14mm; background: #fbfcfe; }
  .footer-brand { display: flex; min-width: 0; align-items: center; gap: 2.2mm; }
  .footer-brand strong, .footer-brand small { display: block; }
  .footer-brand strong { color: #33414f; font-size: 6.4pt; line-height: 1.1; font-weight: 700; }
  .footer-brand small { margin-top: 0.6mm; color: #6b7885; font-size: 5.7pt; }
  .footer-municipal-logo { width: 8.4mm; height: 8.4mm; object-fit: contain; }
  .footer-dia-logo { width: 25mm; height: 8mm; object-fit: contain; }
  .footer-attribution { color: #9aa6b2; font-size: 6.3pt; line-height: 1.25; text-align: right; }
  .footer-attribution small { display: block; margin-top: 0.7mm; color: #b0bac4; font-size: 5.6pt; }

  @media screen {
    body { padding: 12mm 0; background: #dfe5ec; }
    .pdf-page { margin: 0 auto 10mm; box-shadow: 0 4mm 14mm rgba(16, 35, 61, 0.18); }
  }
`;

export function renderInstitutionalSummary(
  payload: SummaryPayload,
  options: InstitutionalSummaryOptions,
  mode: { print?: boolean } = {}
): string {
  const total = 4;
  const pages = [
    renderPageOne(payload, options, total),
    renderSectionsPage(payload, options, 2, "Hallazgos principales", 0, total),
    renderSectionsPage(payload, options, 3, "Implicancias para la gestión", 2, total),
    renderClosingPage(payload, options, total)
  ].join("");

  return [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.titulo)}</title><style>${INSTITUTIONAL_SUMMARY_STYLES}</style></head><body>`,
    `<div class="pdf-document">${pages}</div>`,
    mode.print ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>` : "",
    "</body></html>"
  ].join("");
}
