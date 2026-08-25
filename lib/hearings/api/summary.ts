import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import {
  downloadHearingDocument,
  downloadNormDocument,
  hasSupabaseStorage,
  removeHearingDocument,
  uploadHearingDocument
} from "@/lib/storage/supabase";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { PdfBrowserError, PdfOverflowError, renderHtmlToPdf } from "@/lib/pdf/render-pdf";
import { generateSummary } from "@/lib/hearings/summary-generate";
import { digestTranscript } from "@/lib/hearings/transcript-digest";
import { formatSummaryMaterial, loadHearingSummaryMaterial } from "@/lib/hearings/summary-material";
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

// Documentos ENTEROS: con 12k, un PPT institucional de 27 páginas entraba al
// 43% y el resumen salía pobre y general (comparado contra el resumen de la
// Comisión FAU hecho a mano, 2026-08-03).
const MAX_DOC_CHARS = 30_000;
/*
 * Antes eran 2 documentos y un solo origen. Las audiencias reales traen 4 o 5
 * presentaciones --una por organización expositora--, así que con 2 el resumen
 * se escribía ignorando a la mayoría. El presupuesto total acota el costo: los
 * primeros documentos pueden entrar enteros y los últimos entran recortados,
 * que es mejor que dejarlos afuera sin decirlo.
 */
const MAX_DOCS = 6;
const MAX_TOTAL_DOC_CHARS = 90_000;

type DocumentExcerpt = {
  name: string;
  material: string;
  truncated: boolean;
};

/** De dónde sale el PDF: los presentados en la audiencia viven en otro bucket. */
type DocumentSource = { name: string; storagePath: string; download: (path: string) => Promise<Uint8Array> };

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

/**
 * Texto de los documentos aportados, para darle contexto al redactor.
 *
 * Sale de DOS lugares. Las presentaciones de las organizaciones expositoras se
 * cargan a la audiencia desde la Fábrica y viven en el bucket de normas
 * (`ReformDocument`); los archivos que se suben directamente al expediente de la
 * audiencia viven en el de audiencias (`HearingDocument`).
 *
 * Antes se leía sólo el segundo. Después de mover los PDFs de la reforma a su
 * audiencia, ese origen quedó prácticamente vacío y el resumen se escribía sin
 * abrir ninguna de las presentaciones: sólo con la transcripción.
 */
async function documentExcerpts(meetingId: string): Promise<DocumentExcerpt[]> {
  const [reformDocuments, hearingDocuments] = await Promise.all([
    prisma.reformDocument.findMany({
      where: { meetingId, storagePath: { not: null } },
      orderBy: { uploadedAt: "asc" },
      select: { name: true, storagePath: true },
      take: 20
    }),
    prisma.hearingDocument.findMany({
      where: { hearingRecord: { meetingId }, storagePath: { not: null } },
      orderBy: { id: "desc" },
      select: { name: true, storagePath: true },
      take: 20
    })
  ]);

  const sources: DocumentSource[] = [
    ...reformDocuments.map((document) => ({
      name: document.name,
      storagePath: document.storagePath as string,
      download: downloadNormDocument
    })),
    ...hearingDocuments.map((document) => ({
      name: document.name,
      storagePath: document.storagePath as string,
      download: downloadHearingDocument
    }))
  ];

  const excerpts: DocumentExcerpt[] = [];
  let budget = MAX_TOTAL_DOC_CHARS;
  for (const source of sources) {
    if (excerpts.length >= MAX_DOCS || budget <= 0) break;
    const extension = source.name.slice(source.name.lastIndexOf(".")).toLowerCase();
    if (extension !== ".pdf" && extension !== ".txt") continue;
    const cap = Math.min(MAX_DOC_CHARS, budget);
    try {
      const bytes = await source.download(source.storagePath);
      let text = "";
      let truncated = false;
      if (extension === ".pdf") {
        const extraction = await extractPdfText(bytes, { maxPages: 60, maxChars: cap });
        text = sanitizePdfText(extraction.text);
        truncated = extraction.truncated || extraction.readPages < extraction.pages;
      } else {
        const fullText = sanitizePdfText(new TextDecoder("utf-8").decode(bytes));
        text = fullText.slice(0, cap);
        truncated = fullText.length > text.length;
      }
      if (text.trim().length >= 200) {
        budget -= text.length;
        excerpts.push({
          name: source.name,
          material: `DOCUMENTO PRESENTADO "${source.name}"${truncated ? " (EXTRACTO PARCIAL)" : ""}:\n${text}`,
          truncated
        });
      }
    } catch (error) {
      // Un PDF escaneado o un archivo que ya no está en el bucket no puede
      // frenar el resumen: se sigue con el resto y el pie declara qué se leyó.
      console.warn(`Resumen: no se pudo leer "${source.name}".`, error instanceof Error ? error.message : error);
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

  /*
   * La transcripción entra COMPLETA, por tramos si hace falta.
   *
   * Antes se recortaba: los primeros 30.000 caracteres, un marcador que decía
   * "[TRAMO INTERMEDIO OMITIDO POR EXTENSIÓN]" y los últimos 30.000. Medido
   * sobre las audiencias reales, eso descartaba el medio de 4 de 7 --entre el
   * 17% y el 38% del contenido-- y el documento salía con membrete municipal
   * igual. Ver lib/hearings/transcript-digest.ts.
   */
  const digesto = await digestTranscript(hearing.transcriptSegments);
  const transcript = digesto.material;

  const [excerpts, registro] = await Promise.all([documentExcerpts(id), loadHearingSummaryMaterial(id)]);
  const registroTexto = formatSummaryMaterial(registro);

  /*
   * Con documentos analizados alcanza para redactar, aunque no haya
   * transcripción: quiénes expusieron, qué propusieron y qué artículos tocan ya
   * son un documento útil. Tres de las audiencias cargadas no tienen audio
   * transcripto y quedaban sin resumen por esta puerta.
   */
  if (transcript.trim().length < 400 && excerpts.length === 0 && !registro.propuestas.length) {
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
    // Lo ya registrado va PRIMERO y con su advertencia: el redactor tiene que
    // saber qué páginas del documento ya existen antes de decidir qué escribir.
    registroTexto || null,
    // Sin etiqueta propia: el digesto ya trae su encabezado, que dice si viaja
    // completa o resumida en tramos. Ponerle "(puede estar recortada)" arriba,
    // como antes, le avisaba al redactor de una limitación que ya no existe y lo
    // volvía cauto sin motivo.
    transcript.trim() ? transcript : null,
    ...excerpts.map((excerpt) => excerpt.material)
  ]
    .filter(Boolean)
    .join("\n\n");

  let payload: SummaryPayload;
  try {
    // Dos pasadas con el modelo fuerte: esqueleto + secciones en paralelo. Un
    // solo prompt producía secciones de un párrafo con relleno (2026-08-03).
    const redactado = await generateSummary(material, { registrado: Boolean(registroTexto) });
    payload = {
      ...redactado,
      // La lista verificada gana sobre la que dedujo el modelo. La suya sólo se
      // usa cuando la audiencia no tiene documentos cargados.
      expositores: registro.expositores.length
        ? registro.expositores.map((presenter) => presenter.organizacion)
        : redactado.expositores,
      ...(registro.expositores.length ? { material: registro } : {})
    };
  } catch (error) {
    console.error("No se pudo generar el resumen de la audiencia", error);
    return { ok: false, response: errorResponse("No se pudo generar el resumen", generationErrorDetail(error), 502) };
  }

  const options = { hearingTitle: hearing.title, when, docCode: `AUD-${id.slice(-6).toUpperCase()}` };
  const monthYear = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  // El pie del documento declara sobre qué se redactó. Dice la verdad de cada
  // caso: completa, completa por tramos, o con tramos que no se pudieron
  // procesar. Antes decía "parcial: inicio y cierre", que era honesto pero
  // describía una limitación que ya no existe.
  const sourceSummary = [
    transcript.trim()
      ? digesto.tramosPerdidos > 0
        ? `Transcripción en ${digesto.tramos} tramos (${digesto.tramosPerdidos} sin procesar)`
        : digesto.tramos > 0
          ? `Transcripción completa, analizada en ${digesto.tramos} tramos`
          : "Transcripción completa"
      : null,
    excerpts.length
      ? `${excerpts.length} ${excerpts.length === 1 ? "documento" : "documentos"}: ${excerpts
          .map((excerpt) => `${excerpt.name}${excerpt.truncated ? " (extracto)" : ""}`)
          .join(", ")}`
      : null,
    registro.propuestas.length
      ? `${registro.propuestas.length} propuestas registradas de ${registro.expositores.length} organizaciones`
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
    // Tres fallas distintas viajaban con el mismo texto ("el servicio de
    // exportación no respondió"), y una de ellas ni siquiera era del servicio.
    // Con el mensaje indistinto, un binario que no viajó a la función se leyó
    // durante días como una caída pasajera que se arreglaba reintentando.
    if (error instanceof PdfOverflowError) {
      return {
        ok: false,
        response: errorResponse(
          "El resumen no entra en el documento",
          "La IA redactó un texto más largo que el espacio imprimible. Volvé a generarlo: cada redacción sale distinta y suele entrar. Si vuelve a pasar, avisá al equipo administrador.",
          422
        )
      };
    }
    if (error instanceof PdfBrowserError) {
      return {
        ok: false,
        response: errorResponse(
          "El exportador de PDF no está disponible",
          "El documento fue redactado pero no se pudo convertir a PDF: el conversor no arrancó en el servidor. Reintentar no lo va a resolver — avisá al equipo administrador.",
          503
        )
      };
    }
    return {
      ok: false,
      response: errorResponse(
        "No se pudo generar el PDF",
        "El documento fue redactado, pero falló la conversión a PDF. Probá de nuevo en unos minutos.",
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
  return session && hasPermission(session, "content.publish") ? session : null;
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
