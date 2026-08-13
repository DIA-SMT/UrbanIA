import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import {
  downloadHearingDocument,
  hasSupabaseStorage,
  removeHearingDocument,
  uploadHearingDocument
} from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { renderHtmlToPdf } from "@/lib/pdf/render-pdf";
import { generateSummary } from "@/lib/hearings/summary-generate";
import { renderInstitutionalSummary, type SummaryPayload } from "@/lib/hearings/summary-document";
import {
  getCitySmtWhiteLogoDataUri,
  getDiaLogoDataUri,
  getMunicipalIsoLogoDataUri
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

type DocumentExcerpt = {
  name: string;
  material: string;
  truncated: boolean;
};

function errorResponse(title: string, detail: string, status: number): NextResponse {
  return NextResponse.json(
    { error: title, detail },
    {
      status,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

function generationErrorDetail(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  const message = error instanceof Error ? error.message : "";

  if (status === 401 || status === 403) {
    return "El servicio de IA rechazó las credenciales configuradas. Contactá al equipo administrador.";
  }
  if (status === 402) {
    return "El servicio de IA no tiene crédito disponible para completar el resumen. Contactá al equipo administrador.";
  }
  if (status === 429) {
    return "El servicio de IA está recibiendo demasiadas solicitudes. Esperá unos minutos y volvé a intentar.";
  }
  if (status === 408 || status === 504 || /timeout|timed out/i.test(message)) {
    return "El servicio de IA demoró más de lo permitido. Volvé a intentar en unos minutos.";
  }
  if (/esqueleto|secciones|párrafos|respuesta.*(?:json|válid)|incompleto/i.test(message)) {
    return "La IA devolvió un contenido incompleto incluso después de reintentarlo. Volvé a generar el resumen.";
  }
  return "El servicio de análisis no pudo completar el documento. Volvé a intentar en unos minutos.";
}

function encodeContentDispositionFileName(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Texto de los documentos PDF/TXT aportados, recortado, para darle contexto al redactor. */
async function documentExcerpts(meetingId: string): Promise<DocumentExcerpt[]> {
  const documents = await prisma.hearingDocument.findMany({
    where: { hearingRecord: { meetingId }, storagePath: { not: null } },
    orderBy: { id: "desc" },
    select: { name: true, storagePath: true },
    take: 20
  });

  const excerpts: DocumentExcerpt[] = [];
  for (const document of documents) {
    if (excerpts.length >= MAX_DOCS || !document.storagePath) continue;
    const extension = document.name.slice(document.name.lastIndexOf(".")).toLowerCase();
    if (extension !== ".pdf" && extension !== ".txt") continue;
    try {
      const bytes = await downloadHearingDocument(document.storagePath);
      let text = "";
      let truncated = false;
      if (extension === ".pdf") {
        const extraction = await extractPdfText(bytes, { maxPages: 60, maxChars: MAX_DOC_CHARS });
        text = sanitizePdfText(extraction.text);
        truncated = extraction.truncated || extraction.readPages < extraction.pages;
      } else {
        const fullText = sanitizePdfText(new TextDecoder("utf-8").decode(bytes));
        text = fullText.slice(0, MAX_DOC_CHARS);
        truncated = fullText.length > text.length;
      }
      if (text.trim().length >= 200) {
        excerpts.push({
          name: document.name,
          material: `DOCUMENTO APORTADO "${document.name}"${truncated ? " (EXTRACTO PARCIAL)" : ""}:\n${text}`,
          truncated
        });
      }
    } catch (error) {
      console.warn(`Resumen: no se pudo leer "${document.name}".`, error instanceof Error ? error.message : error);
    }
  }
  return excerpts;
}

/** PDF listo + su nombre de archivo, o un error ya formateado para responder. */
type BuiltSummary = { ok: true; pdf: Buffer; fileName: string } | { ok: false; response: NextResponse };

/**
 * Genera el resumen ejecutivo en PDF. Es el paso caro (dos pasadas del modelo
 * + render con Chromium), asi que vive separado del handler: lo usan tanto la
 * descarga como la publicacion para la ciudadania.
 */
async function buildSummaryPdf(id: string): Promise<BuiltSummary> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, response: errorResponse("Base de datos no disponible", "No se puede generar el resumen en este momento.", 503) };
  }
  if (!hasOpenRouterConfig()) {
    return { ok: false, response: errorResponse("IA no configurada", "Falta configurar el servicio de análisis para esta instancia.", 503) };
  }

  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) {
    return { ok: false, response: errorResponse("Audiencia no encontrada", "El enlace no corresponde a una audiencia del registro.", 404) };
  }

  const fullTranscript = hearing.transcriptSegments
    .map((segment) => `${segment.speakerLabel ? `${segment.speakerLabel}: ` : ""}${segment.content}`)
    .join("\n");
  const transcriptWasTruncated = fullTranscript.length > MAX_TRANSCRIPT_CHARS;
  const transcript = transcriptWasTruncated
    ? [
        fullTranscript.slice(0, MAX_TRANSCRIPT_CHARS / 2),
        "[TRAMO INTERMEDIO OMITIDO POR EXTENSIÓN; EL RESUMEN ANALIZA EL INICIO Y EL CIERRE]",
        fullTranscript.slice(-MAX_TRANSCRIPT_CHARS / 2)
      ].join("\n\n")
    : fullTranscript;

  const excerpts = await documentExcerpts(id);

  if (transcript.trim().length < 400 && excerpts.length === 0) {
    return {
      ok: false,
      response: errorResponse(
        "Material insuficiente",
        "Esta audiencia todavía no tiene transcripción ni documentos con texto: no hay de dónde redactar un resumen.",
        422
      )
    };
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
    ...excerpts.map((excerpt) => excerpt.material)
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
    return { ok: false, response: errorResponse("No se pudo generar el resumen", generationErrorDetail(error), 502) };
  }

  const options = { hearingTitle: hearing.title, when, docCode: `AUD-${id.slice(-6).toUpperCase()}` };
  const monthYear = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  const sourceSummary = [
    transcript.trim()
      ? transcriptWasTruncated
        ? "Transcripción parcial: inicio y cierre"
        : "Transcripción completa"
      : null,
    excerpts.length
      ? `${excerpts.length} ${excerpts.length === 1 ? "documento" : "documentos"}: ${excerpts
          .map((excerpt) => `${excerpt.name}${excerpt.truncated ? " (extracto)" : ""}`)
          .join(", ")}`
      : null
  ]
    .filter(Boolean)
    .join(" | ");
  const municipalHeaderLogo = getCitySmtWhiteLogoDataUri();
  const municipalFooterLogo = getMunicipalIsoLogoDataUri();
  const diaLogo = getDiaLogoDataUri();
  if (!municipalHeaderLogo || !municipalFooterLogo || !diaLogo) {
    return {
      ok: false,
      response: errorResponse(
        "Identidad institucional no disponible",
        "Falta uno de los recursos oficiales necesarios para generar el PDF. Contactá al equipo administrador.",
        500
      )
    };
  }
  const documentOptions = {
    ...options,
    monthYear: monthYear.charAt(0).toUpperCase() + monthYear.slice(1),
    sourceSummary,
    municipalHeaderLogo,
    municipalFooterLogo,
    diaLogo
  };

  // La acción siempre entrega un PDF binario. Si Chromium falla, mostramos un
  // error explícito para que el usuario pueda reintentar sin descargar HTML con
  // una extensión o una expectativa equivocadas.
  try {
    const pdf = await renderHtmlToPdf(renderInstitutionalSummary(payload, documentOptions));
    const readableTitle =
      hearing.title
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Audiencia";
    const fileName = `Resumen ejecutivo - ${readableTitle}.pdf`;
    return { ok: true, pdf, fileName };
  } catch (error) {
    console.error("No se pudo renderizar el PDF de la audiencia.", error);
    return {
      ok: false,
      response: errorResponse(
        "No se pudo generar el PDF",
        "El documento fue redactado, pero el servicio de exportación no respondió. Probá de nuevo en unos minutos.",
        503
      )
    };
  }
}

/** Nombre ASCII de respaldo para Content-Disposition. */
function fallbackFileName(fileName: string) {
  const readableTitle = fileName.replace(/^Resumen ejecutivo - /, "").replace(/\.pdf$/, "");
  return `Resumen_${readableTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "audiencia"}.pdf`;
}

/** Solo personal municipal: generar cuesta dos pasadas del modelo. */
async function requireStaff() {
  const session = await getSessionUser();
  return session && isStaff(session.role) ? session : null;
}

/** GET ?action=resumen — descarga el PDF recien generado (uso interno). */
export async function handleSummaryPdf(_request: Request, id: string) {
  if (!(await requireStaff())) {
    return errorResponse("Sesión requerida", "Ingresá con tu cuenta municipal para generar el resumen.", 401);
  }

  const built = await buildSummaryPdf(id);
  if (!built.ok) return built.response;

  return new NextResponse(new Uint8Array(built.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fallbackFileName(built.fileName)}"; filename*=UTF-8''${encodeContentDispositionFileName(built.fileName)}`,
      "Cache-Control": "no-store"
    }
  });
}

/**
 * POST ?action=publicar-resumen — genera el PDF, lo sube al bucket de
 * audiencias y lo deja publicado en el portal ciudadano. El vecino descarga
 * ESTE archivo: nunca dispara una generacion.
 */
export async function handlePublishSummary(_request: Request, id: string) {
  if (!(await requireStaff())) {
    return errorResponse("Sesión requerida", "Ingresá con tu cuenta municipal para publicar el resumen.", 401);
  }
  if (!hasSupabaseStorage()) {
    return errorResponse("Almacenamiento no disponible", "Falta configurar Supabase Storage para publicar documentos.", 503);
  }

  const built = await buildSummaryPdf(id);
  if (!built.ok) return built.response;

  const previous = await prisma.meeting.findUnique({ where: { id }, select: { publicSummaryPath: true } });

  try {
    const uploaded = await uploadHearingDocument({
      meetingId: id,
      fileName: built.fileName,
      contentType: "application/pdf",
      bytes: built.pdf
    });

    await prisma.meeting.update({
      where: { id },
      data: { publicSummaryUrl: uploaded.url, publicSummaryPath: uploaded.storagePath, publicSummaryAt: new Date() }
    });

    // El anterior ya no lo referencia nadie: se borra despues de guardar el
    // nuevo, para no quedarse sin resumen publicado si algo falla.
    if (previous?.publicSummaryPath && previous.publicSummaryPath !== uploaded.storagePath) {
      await removeHearingDocument(previous.publicSummaryPath).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, url: uploaded.url });
  } catch (error) {
    console.error("No se pudo publicar el resumen de la audiencia.", error);
    return errorResponse("No se pudo publicar", "El PDF se generó, pero no se pudo guardar en el almacenamiento.", 503);
  }
}

/** POST ?action=despublicar-resumen — saca el resumen del portal ciudadano. */
export async function handleUnpublishSummary(_request: Request, id: string) {
  if (!(await requireStaff())) {
    return errorResponse("Sesión requerida", "Ingresá con tu cuenta municipal para despublicar el resumen.", 401);
  }

  const meeting = await prisma.meeting.findUnique({ where: { id }, select: { publicSummaryPath: true } });
  if (!meeting) {
    return errorResponse("Audiencia no encontrada", "El enlace no corresponde a una audiencia del registro.", 404);
  }

  await prisma.meeting.update({
    where: { id },
    data: { publicSummaryUrl: null, publicSummaryPath: null, publicSummaryAt: null }
  });

  if (meeting.publicSummaryPath) {
    await removeHearingDocument(meeting.publicSummaryPath).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
