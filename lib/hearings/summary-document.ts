/**
 * Cuerpo y estilos del resumen ejecutivo de una audiencia. Sin dependencias de
 * servidor a propósito: el handler lo envuelve con el shell institucional
 * (document-shell), y los scripts de previsualización pueden renderizarlo con
 * datos de muestra sin sesión ni base.
 */

export type SummaryPayload = {
  titulo: string;
  bajada: string;
  expositor: string;
  destinatario: string;
  estructura: string;
  secciones: { titulo: string; parrafos: string[]; destacados?: string[] }[];
  lineasDeAccion?: string[];
};

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export const SUMMARY_STYLES = `
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; }
  .resumen-cabecera { border-bottom: 3px solid #1f89f6; padding-bottom: 14px; margin-bottom: 16px; }
  .resumen-cabecera .sello { display: inline-block; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: #0c4a8c; font-weight: 700; background: #e8f1fc; border-radius: 999px; padding: 4px 12px; margin: 0 0 12px; }
  .resumen-cabecera h1 { font-size: 27px; line-height: 1.22; margin: 0 0 10px; letter-spacing: -0.5px; color: #0b1a33; }
  .resumen-cabecera .bajada { font-size: 13px; line-height: 1.65; color: #475569; margin: 0; max-width: 62ch; }
  .resumen-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; background: #f4f7fb; border: 1px solid #e1e9f2; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; }
  .resumen-meta span { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #1f89f6; font-weight: 800; }
  .resumen-meta p { font-size: 11.5px; line-height: 1.55; margin: 3px 0 0; color: #1e293b; }
  .resumen-seccion { page-break-inside: avoid; margin-bottom: 18px; }
  .resumen-seccion h2 { font-size: 15px; margin: 18px 0 8px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 7px; color: #0b1a33; }
  .resumen-seccion h2 .num { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: #1f89f6; color: #fff; font-size: 12px; font-weight: 800; flex-shrink: 0; }
  .resumen-seccion h2 .titulo { letter-spacing: -0.2px; }
  .resumen-seccion p { font-size: 11.8px; line-height: 1.7; margin: 7px 0; text-align: justify; }
  .resumen-seccion ul { margin: 8px 0; padding-left: 4px; list-style: none; }
  .resumen-seccion li { font-size: 11.8px; line-height: 1.65; margin: 6px 0; padding-left: 18px; position: relative; }
  .resumen-seccion li::before { content: ""; position: absolute; left: 0; top: 7px; width: 8px; height: 8px; border-radius: 2px; background: #1f89f6; }
  .destacado { border-left: 3px solid #1f89f6; background: #eef5fd; border-radius: 0 6px 6px 0; padding: 9px 14px; margin: 10px 0; }
  .destacado p { font-size: 11.5px; font-style: italic; color: #17406b; margin: 0; text-align: left; }
  .acciones { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 16px 12px; }
  .nota-final { font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 9px; margin-top: 26px; }
`;

export function renderSummaryBody(payload: SummaryPayload, options: { hearingTitle: string; when: string }): string {
  const meta = [
    `<div class="resumen-meta">`,
    `<div><span>Expositor</span><p>${escapeHtml(payload.expositor)}</p></div>`,
    `<div><span>Destinatario</span><p>${escapeHtml(payload.destinatario)}</p></div>`,
    `<div><span>Audiencia</span><p>${escapeHtml(options.hearingTitle)} · ${escapeHtml(options.when)}</p></div>`,
    `<div><span>Estructura</span><p>${escapeHtml(payload.estructura)}</p></div>`,
    `</div>`
  ].join("");

  const sections = payload.secciones
    .map((section, index) => {
      const paragraphs = section.parrafos.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      const highlights = section.destacados?.length
        ? section.destacados.map((highlight) => `<div class="destacado"><p>${escapeHtml(highlight)}</p></div>`).join("")
        : "";
      return `<section class="resumen-seccion"><h2><span class="num">${index + 1}</span><span class="titulo">${escapeHtml(section.titulo)}</span></h2>${paragraphs}${highlights}</section>`;
    })
    .join("");

  const actions = payload.lineasDeAccion?.length
    ? `<section class="resumen-seccion acciones"><h2><span class="num">${payload.secciones.length + 1}</span><span class="titulo">Líneas de acción</span></h2><ul>${payload.lineasDeAccion
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul></section>`
    : "";

  return [
    `<header class="resumen-cabecera">`,
    `<p class="sello">Resumen ejecutivo · Audiencia pública</p>`,
    `<h1>${escapeHtml(payload.titulo)}</h1>`,
    `<p class="bajada">${escapeHtml(payload.bajada)}</p>`,
    `</header>`,
    meta,
    sections,
    actions,
    `<p class="nota-final">Borrador redactado con asistencia de IA a partir de la transcripción y los documentos de la audiencia. La IA orienta; el equipo municipal revisa y valida antes de circular.</p>`
  ].join("");
}
