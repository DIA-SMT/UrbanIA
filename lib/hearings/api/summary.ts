import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { downloadHearingDocument } from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { renderHtmlToPdf } from "@/lib/pdf/render-pdf";
import { generateSummary } from "@/lib/hearings/summary-generate";
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
// Documentos ENTEROS: con 12k, un PPT institucional de 27 páginas entraba al
// 43% y el resumen salía pobre y general (comparado contra el resumen de la
// Comisión FAU hecho a mano, 2026-08-03).
const MAX_DOC_CHARS = 30_000;
const MAX_DOCS = 2;

import { escapeHtml, renderSummaryBody, SUMMARY_STYLES, type SummaryPayload } from "@/lib/hearings/summary-document";

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
    // Dos pasadas con el modelo fuerte: esqueleto + secciones en paralelo. Un
    // solo prompt producía secciones de un párrafo con relleno (2026-08-03).
    payload = await generateSummary(material);
  } catch (error) {
    console.error("No se pudo generar el resumen de la audiencia", error);
    return errorPage("No se pudo generar el resumen", "El servicio de análisis no devolvió un documento válido. Probá de nuevo en unos minutos.", 502);
  }

  const options = { hearingTitle: hearing.title, when, docCode: `AUD-${id.slice(-6).toUpperCase()}` };

  // PDF binario directo. Si Chromium fallara en la función, el mismo documento
  // baja como HTML imprimible (el flujo viejo) en vez de perder la corrida.
  try {
    const pdf = await renderHtmlToPdf(renderSummaryDocument(payload, options, { print: false }));
    const fileName = `Resumen_${hearing.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "audiencia"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error("Chromium no disponible para el PDF; se sirve HTML imprimible.", error);
    return new NextResponse(renderSummaryDocument(payload, options, { print: true }), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}

/** Envuelve el cuerpo del resumen con el shell institucional imprimible. */
function renderSummaryDocument(
  payload: SummaryPayload,
  options: { hearingTitle: string; when: string; docCode: string },
  mode: { print: boolean }
): string {
  return [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(payload.titulo)}</title><style>${SUMMARY_STYLES}${DOCUMENT_SHELL_STYLES}</style></head><body>`,
    renderWatermark(),
    renderLetterhead({ subtitle: "Audiencias Públicas · Resumen ejecutivo", docCode: options.docCode, statusLabel: "Documento de trabajo" }),
    `<main class="doc-body">${renderSummaryBody(payload, options)}</main>`,
    renderFooter({ docCode: options.docCode }),
    mode.print ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>` : "",
    "</body></html>"
  ].join("");
}
