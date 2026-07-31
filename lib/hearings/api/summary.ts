import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { downloadHearingDocument } from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import {
  DOCUMENT_SHELL_STYLES,
  renderFooter,
  renderLetterhead,
  renderWatermark
} from "@/lib/brand/document-shell";

/**
 * Resumen ejecutivo de una audiencia como documento imprimible con membrete
 * institucional (mismo shell que los exports de la Fábrica): la IA redacta un
 * borrador estructurado a partir de la transcripción, el análisis existente y
 * los documentos aportados; el equipo lo revisa antes de circularlo — el pie
 * de "documento de trabajo" lo deja explícito.
 */

// La transcripción entera de una audiencia larga no entra ni hace falta:
// 60k caracteres cubren ~2 horas de exposición hablada.
const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_DOC_CHARS = 12_000;
const MAX_DOCS = 2;

type SummaryPayload = {
  titulo: string;
  bajada: string;
  expositor: string;
  destinatario: string;
  estructura: string;
  secciones: { titulo: string; parrafos: string[]; destacados?: string[] }[];
  lineasDeAccion?: string[];
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function errorPage(title: string, detail: string, status: number): NextResponse {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui;max-width:520px;margin:80px auto;color:#0f172a"><h1 style="font-size:20px">${escapeHtml(title)}</h1><p style="line-height:1.6;color:#475569">${escapeHtml(detail)}</p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Texto de los documentos PDF/TXT aportados, recortado, para darle contexto al redactor. */
async function documentExcerpts(meetingId: string): Promise<string[]> {
  const documents = await prisma.hearingDocument.findMany({
    where: { hearingRecord: { meetingId }, storagePath: { not: null } },
    orderBy: { id: "desc" },
    select: { name: true, storagePath: true },
    take: 6
  });

  const excerpts: string[] = [];
  for (const document of documents) {
    if (excerpts.length >= MAX_DOCS || !document.storagePath) continue;
    const extension = document.name.slice(document.name.lastIndexOf(".")).toLowerCase();
    if (extension !== ".pdf" && extension !== ".txt") continue;
    try {
      const bytes = await downloadHearingDocument(document.storagePath);
      const text =
        extension === ".pdf"
          ? sanitizePdfText((await extractPdfText(bytes, { maxPages: 60, maxChars: MAX_DOC_CHARS })).text)
          : sanitizePdfText(new TextDecoder("utf-8").decode(bytes)).slice(0, MAX_DOC_CHARS);
      if (text.trim().length >= 200) {
        excerpts.push(`DOCUMENTO APORTADO "${document.name}":\n${text}`);
      }
    } catch (error) {
      console.warn(`Resumen: no se pudo leer "${document.name}".`, error instanceof Error ? error.message : error);
    }
  }
  return excerpts;
}

const CONTRACT = [
  "Respondé SOLO con un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma exacta:",
  `{"titulo": "...", "bajada": "...", "expositor": "...", "destinatario": "...", "estructura": "I. ... · II. ... · III. ...", "secciones": [{"titulo": "...", "parrafos": ["...", "..."], "destacados": ["..."]}], "lineasDeAccion": ["..."]}`,
  "- titulo: editorial y fiel al contenido, sin comillas internas.",
  "- bajada: 1 o 2 oraciones que enmarquen el aporte.",
  "- expositor/destinatario: como corresponda a ESTA audiencia.",
  "- estructura: los bloques del documento separados por ' · '.",
  "- secciones: entre 4 y 8, numerables, cada una con 2 a 5 párrafos sustanciosos; destacados solo si hay frases o datos que merecen resaltarse (opcional).",
  "- lineasDeAccion: bullets accionables SOLO si surgen del material (opcional).",
  "Reglas: basate EXCLUSIVAMENTE en la transcripción, el análisis y los documentos provistos. No inventes cifras, nombres ni posiciones. Si algo no está en el material, no lo escribas. Español institucional claro, sin jerga innecesaria."
].join("\n");

export async function handleSummaryPdf(_request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return errorPage("Base de datos no disponible", "No se puede generar el resumen en este momento.", 503);
  }
  const session = await getSessionUser();
  if (!session || !isStaff(session.role)) {
    return errorPage("Sesión requerida", "Ingresá con tu cuenta municipal para generar el resumen.", 401);
  }
  if (!hasOpenRouterConfig()) {
    return errorPage("IA no configurada", "Falta configurar el servicio de análisis para esta instancia.", 503);
  }

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) {
    return errorPage("Audiencia no encontrada", "El enlace no corresponde a una audiencia del registro.", 404);
  }

  const transcript = hearing.transcriptSegments
    .map((segment) => `${segment.speakerLabel ? `${segment.speakerLabel}: ` : ""}${segment.content}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);

  const excerpts = await documentExcerpts(id);

  if (transcript.trim().length < 400 && excerpts.length === 0) {
    return errorPage(
      "Material insuficiente",
      "Esta audiencia todavía no tiene transcripción ni documentos con texto: no hay de dónde redactar un resumen.",
      422
    );
  }

  const when = hearing.occurredAt
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(hearing.occurredAt))
    : "fecha sin registrar";

  const material = [
    `AUDIENCIA: ${hearing.title}`,
    `FECHA: ${when} · LUGAR: ${hearing.location ?? "sin registrar"} · MODALIDAD: ${hearing.modality ?? "sin registrar"}`,
    hearing.reformCode ? `CÓDIGO NUEVO EN DEBATE: ${hearing.reformCode}${hearing.reformTitle ? ` — ${hearing.reformTitle}` : ""}` : null,
    hearing.participants.length
      ? `PARTICIPANTES REGISTRADOS: ${hearing.participants
          .slice(0, 12)
          .map((participant) => `${participant.displayName}${participant.role ? ` (${participant.role})` : ""}`)
          .join("; ")}`
      : null,
    hearing.analysis?.summary ? `ANÁLISIS PREVIO DEL EQUIPO:\n${hearing.analysis.summary}` : null,
    hearing.analysis?.topics.length ? `TEMAS DETECTADOS: ${hearing.analysis.topics.join("; ")}` : null,
    transcript.trim() ? `TRANSCRIPCIÓN (puede estar recortada):\n${transcript}` : null,
    ...excerpts
  ]
    .filter(Boolean)
    .join("\n\n");

  let payload: SummaryPayload;
  try {
    const response = await askUrbanAssistant(
      [
        {
          role: "system",
          content:
            "Sos el equipo de redacción de la Dirección de Inteligencia Artificial de la Municipalidad de San Miguel de Tucumán. Redactás resúmenes ejecutivos institucionales de audiencias públicas técnicas: fieles al material, estructurados y en español claro."
        },
        { role: "user", content: `${material}\n\n${CONTRACT}` }
      ],
      { json: true, maxTokens: 4500, temperature: 0.3 }
    );
    payload = JSON.parse(response.answer) as SummaryPayload;
    if (!payload?.titulo || !Array.isArray(payload.secciones) || payload.secciones.length === 0) {
      throw new Error("Respuesta sin secciones");
    }
  } catch (error) {
    console.error("No se pudo generar el resumen de la audiencia", error);
    return errorPage("No se pudo generar el resumen", "El servicio de análisis no devolvió un documento válido. Probá de nuevo en unos minutos.", 502);
  }

  const meta = [
    `<div class="resumen-meta">`,
    `<div><span>Expositor</span><p>${escapeHtml(payload.expositor)}</p></div>`,
    `<div><span>Destinatario</span><p>${escapeHtml(payload.destinatario)}</p></div>`,
    `<div><span>Estructura</span><p>${escapeHtml(payload.estructura)}</p></div>`,
    `<div><span>Audiencia</span><p>${escapeHtml(hearing.title)} · ${escapeHtml(when)}</p></div>`,
    `</div>`
  ].join("");

  const sections = payload.secciones
    .map((section, index) => {
      const paragraphs = section.parrafos.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      const highlights = section.destacados?.length
        ? `<div class="destacados">${section.destacados.map((highlight) => `<p>${escapeHtml(highlight)}</p>`).join("")}</div>`
        : "";
      return `<section class="resumen-seccion"><h2><span class="num">${index + 1}</span>${escapeHtml(section.titulo)}</h2>${paragraphs}${highlights}</section>`;
    })
    .join("");

  const actions = payload.lineasDeAccion?.length
    ? `<section class="resumen-seccion"><h2><span class="num">${payload.secciones.length + 1}</span>Líneas de acción</h2><ul>${payload.lineasDeAccion
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul></section>`
    : "";

  const body = [
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

  const styles = `
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; }
  .resumen-cabecera .sello { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #1f89f6; font-weight: 700; margin: 0 0 6px; }
  .resumen-cabecera h1 { font-size: 24px; line-height: 1.25; margin: 0 0 8px; letter-spacing: -0.3px; }
  .resumen-cabecera .bajada { font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 14px; }
  .resumen-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; border: 1px solid #dbe3ec; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; }
  .resumen-meta span { font-size: 9px; letter-spacing: 1.8px; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .resumen-meta p { font-size: 11.5px; line-height: 1.5; margin: 2px 0 0; }
  .resumen-seccion { page-break-inside: avoid; margin-bottom: 14px; }
  .resumen-seccion h2 { font-size: 15px; margin: 14px 0 6px; display: flex; align-items: baseline; gap: 8px; }
  .resumen-seccion h2 .num { color: #1f89f6; font-weight: 800; }
  .resumen-seccion p { font-size: 12px; line-height: 1.65; margin: 6px 0; }
  .resumen-seccion ul { margin: 6px 0; padding-left: 18px; }
  .resumen-seccion li { font-size: 12px; line-height: 1.6; margin: 4px 0; }
  .destacados { border-left: 3px solid #1f89f6; background: #f1f5f9; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  .destacados p { font-size: 11.5px; font-style: italic; color: #334155; }
  .nota-final { font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 22px; }
  `;

  const documentHtml = [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(payload.titulo)}</title><style>${styles}${DOCUMENT_SHELL_STYLES}</style></head><body>`,
    renderWatermark(),
    renderLetterhead({ subtitle: "Audiencias Públicas · Resumen ejecutivo", docCode: `AUD-${id.slice(-6).toUpperCase()}`, statusLabel: "Documento de trabajo" }),
    `<main class="doc-body">${body}</main>`,
    renderFooter({ docCode: `AUD-${id.slice(-6).toUpperCase()}` }),
    `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>`,
    "</body></html>"
  ].join("");

  return new NextResponse(documentHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
