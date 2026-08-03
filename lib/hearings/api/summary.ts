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

const CONTRACT = [
  "Respondé SOLO con un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma exacta:",
  `{"titulo": "...", "bajada": "...", "expositor": "...", "destinatario": "...", "estructura": "I. ... · II. ... · III. ...", "secciones": [{"titulo": "...", "parrafos": ["..."], "destacados": ["..."], "datos": [{"valor": "65 %", "descripcion": "..."}], "tabla": {"titulo": "...", "columnas": ["..."], "filas": [["..."]]}, "subsecciones": [{"titulo": "...", "parrafos": ["..."], "destacados": ["..."], "datos": [...], "tabla": {...}}]}], "lineasDeAccion": ["..."]}`,
  "",
  "El documento objetivo es un RESUMEN EJECUTIVO TÉCNICO de nivel profesional, no una síntesis escolar. La vara:",
  "- EXHAUSTIVIDAD: recorré TODO el material; cada tema sustantivo de la exposición debe tener su sección o subsección. Apuntá a un documento de 15.000 a 22.000 caracteres en total.",
  "- ESPECIFICIDAD OBLIGATORIA: cada cifra, porcentaje, medición, superficie, año o cantidad que aparezca en el material DEBE citarse con su valor exacto. Cada ordenanza, decreto, estudio, programa o instituto DEBE nombrarse tal como aparece (con número, autor o sigla). Un párrafo sin información específica es un párrafo fallido.",
  "- PROHIBIDO el relleno genérico: nada de 'se destacó la importancia de', 'se abordaron diversos temas', 'se hizo hincapié en la necesidad'. Escribí QUÉ se dijo, con sus datos.",
  "",
  "Campos:",
  "- secciones: entre 5 y 8, con la lógica del material (encuadre, principios, diagnóstico, propuestas, instrumentos...). Usá subsecciones (2 a 5) cuando una sección cubra dimensiones o escalas distintas — p. ej. el diagnóstico dividido en dimensión urbana, normativa, interseccional, ambiental.",
  "- datos: los números más potentes de cada bloque como cifras destacadas (valor corto + descripción de una línea). Usalos cada vez que el material los ofrezca.",
  "- tabla: SOLO si el material trae una serie de indicadores comparables (p. ej. un indicador por nivel de vulnerabilidad); columnas y filas fieles al material.",
  "- destacados: frases textuales de la exposición o hallazgos que merecen resaltarse, 1 o 2 por sección donde aplique.",
  "- lineasDeAccion: las propuestas accionables que surgen del material, concretas.",
  "",
  "Reglas de verdad: basate EXCLUSIVAMENTE en la transcripción, el análisis y los documentos provistos. No inventes cifras, nombres ni posiciones; si un dato no está en el material, no existe. Español institucional claro."
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
      // Mismo modelo fuerte que las consultas normativas: el liviano por defecto
      // producía resúmenes genéricos sin datos (comparado 2026-08-03).
      { json: true, maxTokens: 9000, temperature: 0.25, model: process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o" }
    );
    payload = JSON.parse(response.answer) as SummaryPayload;
    if (!payload?.titulo || !Array.isArray(payload.secciones) || payload.secciones.length === 0) {
      throw new Error("Respuesta sin secciones");
    }
  } catch (error) {
    console.error("No se pudo generar el resumen de la audiencia", error);
    return errorPage("No se pudo generar el resumen", "El servicio de análisis no devolvió un documento válido. Probá de nuevo en unos minutos.", 502);
  }

  const documentHtml = renderSummaryDocument(payload, {
    hearingTitle: hearing.title,
    when,
    docCode: `AUD-${id.slice(-6).toUpperCase()}`
  });

  return new NextResponse(documentHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Envuelve el cuerpo del resumen con el shell institucional imprimible. */
function renderSummaryDocument(payload: SummaryPayload, options: { hearingTitle: string; when: string; docCode: string }): string {
  return [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(payload.titulo)}</title><style>${SUMMARY_STYLES}${DOCUMENT_SHELL_STYLES}</style></head><body>`,
    renderWatermark(),
    renderLetterhead({ subtitle: "Audiencias Públicas · Resumen ejecutivo", docCode: options.docCode, statusLabel: "Documento de trabajo" }),
    `<main class="doc-body">${renderSummaryBody(payload, options)}</main>`,
    renderFooter({ docCode: options.docCode }),
    `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>`,
    "</body></html>"
  ].join("");
}
