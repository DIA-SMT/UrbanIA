import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Identidad municipal para documentos imprimibles (PDF via "Guardar como PDF"):
 * membrete con escudo, marca de agua tenue y pie institucional, repetidos en
 * cada pagina impresa. Reutilizable por cualquier export (normas, codigo nuevo,
 * audiencias, etc.).
 *
 * Los logos se embeben como data URI: al imprimir, una <img src="/brand/...">
 * puede no llegar a cargar; el data URI garantiza que el escudo aparezca.
 */

const CIVIC_BLUE = "#1f89f6";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** Cache por asset: cada archivo se lee una sola vez por proceso. */
const logoCache = new Map<string, string | null>();

function readLogoDataUri(relativePath: string): string | null {
  const cached = logoCache.get(relativePath);
  if (cached !== undefined) return cached;

  let dataUri: string | null = null;
  try {
    const buffer = readFileSync(path.join(process.cwd(), relativePath));
    dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    // Sin el asset, el documento sale sin escudo: degradar, no romper.
    dataUri = null;
  }
  logoCache.set(relativePath, dataUri);
  return dataUri;
}

/** Escudo municipal (fondo transparente) como data URI, o null si falta el asset. */
export function getBrandLogoDataUri(): string | null {
  return readLogoDataUri("public/brand/logo-municipalidad-smt-transparent.png");
}

/** Logo de la Direccion de IA para el pie, o null si falta el asset. */
export function getDiaLogoDataUri(): string | null {
  return readLogoDataUri("public/brand/logo-direccion-ia.png");
}

/**
 * Estilos del shell institucional. El membrete y el pie van con position:fixed
 * para repetirse en cada pagina impresa (Chrome repite los fixed por pagina);
 * el contenido reserva espacio con padding para no solaparse.
 */
export const DOCUMENT_SHELL_STYLES = `
  @page { margin: 18mm 16mm; }
  body { margin: 0; padding: 118px 0 76px; background: #ffffff; }
  .doc-letterhead {
    position: fixed; top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding-bottom: 10px; border-bottom: 2px solid ${CIVIC_BLUE};
    background: #ffffff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-letterhead-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .doc-letterhead-shield { height: 52px; width: auto; }
  .doc-letterhead-wordmark { font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: #0b1220; line-height: 1.15; }
  .doc-letterhead-institution { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; font-weight: 700; }
  .doc-letterhead-subtitle { font-size: 11px; color: ${CIVIC_BLUE}; font-weight: 800; margin-top: 2px; }
  .doc-chip {
    flex-shrink: 0; text-align: right; font-size: 11px; font-weight: 800; color: #0b1220;
    border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; background: #f8fafc;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-chip .doc-chip-status { display: block; font-size: 10px; font-weight: 700; color: #475569; margin-top: 1px; }
  .doc-watermark {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    display: flex; align-items: center; justify-content: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-watermark img { width: 62%; max-width: 480px; opacity: 0.05; }
  .doc-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; align-items: center; gap: 10px;
    border-top: 1px solid #e2e8f0; padding-top: 8px;
    font-size: 9.5px; color: #64748b; background: #ffffff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-footer-logo { height: 22px; width: auto; flex-shrink: 0; }
  .doc-footer-code { margin-left: auto; flex-shrink: 0; font-weight: 800; color: #475569; }
`;

export type LetterheadMeta = {
  /** Ej. "Fábrica de Normas · Código nuevo". */
  subtitle: string;
  /** Codigo del documento (ej. NOR-2026-0001) para el chip y el pie. */
  docCode?: string;
  /** Estado legible (ej. "En revisión") para el chip. */
  statusLabel?: string;
};

/** Membrete institucional: escudo + wordmark + linea institucional + chip. */
export function renderLetterhead({ subtitle, docCode, statusLabel }: LetterheadMeta): string {
  const logo = getBrandLogoDataUri();
  const shield = logo
    ? `<img class="doc-letterhead-shield" src="${logo}" alt="Escudo de la Municipalidad de San Miguel de Tucumán">`
    : "";

  const chip =
    docCode || statusLabel
      ? `<div class="doc-chip">${docCode ? escapeHtml(docCode) : ""}${
          statusLabel ? `<span class="doc-chip-status">${escapeHtml(statusLabel)}</span>` : ""
        }</div>`
      : "";

  return [
    `<header class="doc-letterhead">`,
    `<div class="doc-letterhead-identity">`,
    shield,
    `<div>`,
    `<div class="doc-letterhead-wordmark">UrbanIA</div>`,
    `<div class="doc-letterhead-institution">Municipalidad de San Miguel de Tucumán · Planeamiento</div>`,
    `<div class="doc-letterhead-subtitle">${escapeHtml(subtitle)}</div>`,
    `</div>`,
    `</div>`,
    chip,
    `</header>`
  ].join("");
}

/** Marca de agua tenue del escudo, repetida en todas las paginas impresas. */
export function renderWatermark(): string {
  const logo = getBrandLogoDataUri();
  if (!logo) return "";
  return `<div class="doc-watermark" aria-hidden="true"><img src="${logo}" alt=""></div>`;
}

/** Pie institucional con el descargo, la fecha y el codigo del documento. */
export function renderFooter({ docCode }: { docCode?: string }): string {
  const diaLogo = getDiaLogoDataUri();
  const logoTag = diaLogo ? `<img class="doc-footer-logo" src="${diaLogo}" alt="Dirección de IA">` : "";

  return [
    `<footer class="doc-footer">`,
    logoTag,
    `<span>Generado desde UrbanIA — Municipalidad de San Miguel de Tucumán, el ${formatDate(new Date())}. Documento de trabajo; no es texto vigente. La IA orienta; el equipo municipal redacta y valida.</span>`,
    docCode ? `<span class="doc-footer-code">${escapeHtml(docCode)}</span>` : "",
    `</footer>`
  ].join("");
}
