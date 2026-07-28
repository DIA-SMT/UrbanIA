import { NextResponse } from "next/server";
import { z } from "zod";
import { MunicipalArea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { extractPdfText, sanitizePdfText } from "@/lib/pdf/extract-text";
import { downloadNormDocument, hasNormsStorage } from "@/lib/storage/supabase";
import { quoteAppearsIn } from "@/lib/text/normalize-quote";

/** Un PDF de 30 paginas + la pasada del modelo no entra en el default de 10 s. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_PAGES = 120;
const MAX_CHARS = 40_000;
/** Debajo de esto no hay con que trabajar: es un escaneo o puras imagenes. */
const MIN_USEFUL_CHARS = 200;

const bodySchema = z.object({ storagePath: z.string().trim().min(1).max(400) });

const DOCUMENT_KINDS = [
  "PROPUESTA_NORMATIVA",
  "DIAGNOSTICO_TECNICO",
  "PRESENTACION_INSTITUCIONAL",
  "PONENCIA_ACADEMICA",
  "OTRO"
] as const;

/**
 * Normaliza el FORMATO de un valor de enum, sin adivinar el significado.
 *
 * Solo mayusculas, acentos y separadores: "presentación institucional" ->
 * "PRESENTACION_INSTITUCIONAL". Si despues de eso no coincide con ninguno de
 * los valores validos, se devuelve null y el llamador decide el fallback: NO
 * se intenta inferir a que categoria se parecia el texto libre, porque eso
 * seria interpretar por el modelo.
 */
function normalizeEnumValue<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  if (typeof raw !== "string") return null;
  const normalized = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return allowed.find((value) => value === normalized) ?? null;
}

/*
 * Tolerancia deliberada y ASIMETRICA.
 *
 * Los campos de clasificacion (documentKind, areas, confidence) los revisa una
 * persona en la pantalla siguiente, y ya estan como desplegables editables: que
 * el modelo devuelva una etiqueta rara no justifica tirar a la basura un
 * analisis que costo plata y un minuto de espera. Se normaliza el formato y, si
 * aun asi no coincide, se cae a un default seguro.
 *
 * Lo que NO se afloja: title, summary y evidenceQuote siguen siendo
 * obligatorios y la cita se sigue verificando contra el texto real. La
 * tolerancia es para lo cosmetico, nunca para la evidencia.
 */
const proposalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  areas: z.preprocess(
    (raw) =>
      Array.isArray(raw)
        ? raw.map((item) => normalizeEnumValue(item, Object.values(MunicipalArea))).filter(Boolean)
        : [],
    z.array(z.nativeEnum(MunicipalArea)).max(9)
  ),
  sourcePages: z.preprocess(
    (raw) => (Array.isArray(raw) ? raw.filter((page) => Number.isInteger(page) && Number(page) > 0) : []),
    z.array(z.number().int().positive()).max(40)
  ),
  evidenceQuote: z.string().trim().min(1).max(1200),
  // Default "baja" y no "media": ante la duda, la propuesta arranca DESCARTADA
  // en la revision y aceptarla tiene que ser un acto deliberado.
  confidence: z.preprocess(
    (raw) => normalizeEnumValue(raw, ["ALTA", "MEDIA", "BAJA"] as const)?.toLowerCase() ?? "baja",
    z.enum(["alta", "media", "baja"])
  )
});

const analysisSchema = z.object({
  documentKind: z.preprocess(
    (raw) => normalizeEnumValue(raw, DOCUMENT_KINDS) ?? "OTRO",
    z.enum(DOCUMENT_KINDS)
  ),
  documentSummary: z.string().trim().min(1).max(2000),
  organization: z.string().trim().max(200).nullish(),
  authors: z.array(z.string().trim().max(160)).max(20).default([]),
  proposals: z.array(proposalSchema).max(20).default([]),
  warnings: z.array(z.string().trim().max(400)).max(20).default([])
});

/** Texto sin los marcadores de pagina, para medir cuanto contenido real hay. */
function usefulLength(text: string): number {
  return text.replace(/\[Página \d+\]/g, "").replace(/\s+/g, " ").trim().length;
}

const SYSTEM_PROMPT = [
  "Sos Migue, asistente de la Direccion de Inteligencia Artificial de la Municipalidad de San Miguel de Tucuman.",
  "Estas leyendo un documento aportado por una agrupacion, colegio profesional, universidad u ONG a la 1ª Audiencia Publica de la reforma del Codigo de Planeamiento Urbano.",
  "Tu tarea es identificar si el documento contiene PROPUESTAS NORMATIVAS CONCRETAS y, si las hay, describirlas para que una persona del equipo las revise.",
  "",
  "REGLAS, en orden de importancia:",
  "",
  "1. Devolver `proposals: []` es una respuesta VALIDA y FRECUENTE. La mayoria de estos documentos son encuadres institucionales, diagnosticos o ponencias metodologicas sobre como deberia hacerse la reforma: NO son propuestas de norma. No fabriques una propuesta para llenar el formulario. Si no hay propuestas concretas, deja la lista vacia y explica en documentSummary que es el documento.",
  "",
  "2. Una propuesta SOLO cuenta si el documento dice QUE REGLA debe regir, no de que TEMA hay que ocuparse. La prueba es simple: si no podes escribir la regla en una oracion del tipo 'se permite / se prohibe / se exige / el maximo es / el plazo es', NO es una propuesta.",
  "",
  "   SI son propuestas:",
  "   - 'la altura maxima en el corredor sera de 12 metros'",
  "   - 'se exige una cochera cada dos unidades funcionales'",
  "   - 'quedan prohibidos los usos industriales en distritos residenciales'",
  "   - 'invertir la politica de cocheras: pasar de minimos exigidos a maximos permitidos'",
  "",
  "   NO son propuestas (esto es lo que mas te vas a encontrar, y hay que dejarlo pasar de largo):",
  "   - Un ENUNCIADO DE TEMA o titulo de diapositiva: 'REDEFINICION DE DISTRITOS EN LOS SIGUIENTES SECTORES', 'DIVERSIDAD URBANA', 'Exigencia de infraestructura'. Nombran un asunto, no dicen que regla se propone.",
  "   - Una LISTA DE LO QUE EL CODIGO REGULA: 'alturas maximas segun tipologia, FOT, FOS, patios, retiros'. Es el indice de la materia, no un valor propuesto.",
  "   - Un diagnostico: 'falta infraestructura', 'hay deficit habitacional'.",
  "   - Un principio general: 'la ciudad debe ser inclusiva', 'hay que planificar con evidencia'.",
  "   - Una critica al proceso o una descripcion de la situacion actual.",
  "   - La agenda, el cronograma o los participantes de la audiencia.",
  "",
  "   Ante la duda entre 'tema' y 'regla', es TEMA: no lo devuelvas.",
  "",
  "3. El texto viene de DIAPOSITIVAS convertidas a texto. El orden de las palabras puede estar roto, puede haber frases cruzadas entre si y tablas mal separadas. Si una frase no se entiende, NO la interpretes ni la completes: ignorala. Es preferible devolver menos propuestas que inventar una.",
  "   Señal de que estas leyendo el marco de la diapositiva y no su contenido: texto que se repite (el nombre de la institucion, el titulo del evento, la fecha, la numeracion). Si la unica base de una propuesta es un fragmento con ese texto repetido, descartala.",
  "",
  "4. `evidenceQuote` tiene que ser TEXTUAL, copiada caracter por caracter del texto que recibis. No la corrijas, no la completes, no la parafrasees, no le arregles la ortografia ni el orden de las palabras. Si el texto dice 'PO ZOENLAM ATERN ID AD', la cita dice exactamente eso. Una cita que no aparezca textual en el documento hace que la propuesta se descarte.",
  "",
  "5. NO escribas articulado. No redactes el texto del articulo. Eso es un paso posterior y aparte del sistema. Aca solo `title` (un titulo corto) y `summary` (que propone, en 2-5 oraciones).",
  "",
  "6. `sourcePages` sale de los marcadores `[Página N]` que vas a encontrar en el texto. Poné las paginas donde efectivamente aparece la propuesta.",
  "",
  "7. `confidence`: usa 'baja' cuando la propuesta se apoya en texto fragmentario, en una sola linea suelta o en algo que podria ser un titulo de diapositiva sin desarrollo. 'alta' solo cuando el documento desarrolla la regla con claridad.",
  "",
  "8. `areas` son las areas municipales involucradas. Usa EXACTAMENTE estos valores, en mayusculas y con guion bajo: PLANEAMIENTO, OBRAS_PUBLICAS, AMBIENTE, MOVILIDAD, ESPACIO_PUBLICO, DESARROLLO_SOCIAL, HACIENDA, LEGAL, OTRA.",
  "",
  "9. `documentKind` tiene que ser EXACTAMENTE uno de estos cinco valores, tal cual, en mayusculas y con guion bajo. No inventes una etiqueta descriptiva ni traduzcas:",
  "   - PROPUESTA_NORMATIVA: propone reglas concretas para el codigo.",
  "   - DIAGNOSTICO_TECNICO: analiza la situacion (datos, relevamientos, problemas) sin proponer articulado.",
  "   - PRESENTACION_INSTITUCIONAL: encuadre del proceso, agenda, quienes participan, como es la audiencia.",
  "   - PONENCIA_ACADEMICA: argumento metodologico o conceptual sobre como deberia hacerse la reforma.",
  "   - OTRO: cualquier otra cosa.",
  "",
  "10. En `warnings` poné lo que la persona deberia saber: paginas ilegibles, tablas que no se entienden, secciones que parecen tener contenido pero salieron vacias (mapas, planos, graficos).",
  "",
  "Devolves EXCLUSIVAMENTE un objeto JSON valido con esta forma:",
  '{"documentKind":"...","documentSummary":"...","organization":"..."|null,"authors":["..."],"proposals":[{"title":"...","summary":"...","areas":["..."],"sourcePages":[1],"evidenceQuote":"...","confidence":"alta|media|baja"}],"warnings":["..."]}'
].join("\n");

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!hasNormsStorage()) {
    return NextResponse.json({ error: "Almacenamiento no configurado" }, { status: 503 });
  }
  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      { error: "IA no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Falta la ruta del archivo subido." }, { status: 400 });
  }

  // El storagePath lo genera el server al firmar la subida y siempre arranca
  // con el id de la reforma: se verifica para que no se pueda leer el PDF de
  // otra reforma pasando una ruta a mano.
  if (!parsed.data.storagePath.startsWith(`${id}/`)) {
    return NextResponse.json({ error: "Ruta inválida", detail: "El archivo no pertenece a este código nuevo." }, { status: 400 });
  }

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    const bytes = await downloadNormDocument(parsed.data.storagePath);
    const extracted = await extractPdfText(bytes, {
      maxPages: MAX_PAGES,
      maxChars: MAX_CHARS,
      collapseSpaced: true
    });

    // Se sanea UNA vez y se usa el mismo string para el prompt y para verificar
    // las citas. Si el modelo viera un texto y la verificacion comparara contra
    // otro, toda cita valida se descartaria por una diferencia invisible.
    const documentText = sanitizePdfText(extracted.text);

    if (usefulLength(documentText) < MIN_USEFUL_CHARS) {
      return NextResponse.json(
        {
          error: "PDF sin texto legible",
          detail:
            "El PDF no tiene capa de texto legible. Probablemente sea un escaneo o sólo imágenes. Podés guardarlo igual como antecedente de la reforma."
        },
        { status: 422 }
      );
    }

    const response = await askUrbanAssistant(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Reforma: ${reform.title}`,
            "",
            "=== TEXTO EXTRAIDO DEL DOCUMENTO ===",
            documentText,
            "",
            extracted.truncated
              ? "AVISO: el texto se recorto por longitud; puede faltar el final del documento."
              : "",
            "Analiza el documento y devolve el JSON pedido."
          ]
            .filter(Boolean)
            .join("\n")
        }
      ],
      {
        model: process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o",
        json: true,
        temperature: 0.1,
        maxTokens: 3000
      }
    );

    let raw: unknown;
    try {
      raw = JSON.parse(response.answer);
    } catch {
      return NextResponse.json(
        { error: "Respuesta ilegible", detail: "La IA no devolvió un JSON válido. Probá de nuevo." },
        { status: 502 }
      );
    }

    const validated = analysisSchema.safeParse(raw);
    if (!validated.success) {
      console.error("Analisis de PDF con forma invalida", validated.error.flatten());
      return NextResponse.json(
        { error: "Respuesta inesperada", detail: "La IA devolvió campos que no se entienden. Probá de nuevo." },
        { status: 502 }
      );
    }

    // Verificacion de citas: toda propuesta cuya evidencia no aparezca TEXTUAL
    // en el PDF se descarta. Es lo que impide que el modelo invente normas, y
    // es el mismo criterio que ya usa el diagnostico normativo.
    const warnings = [...validated.data.warnings];
    const proposals = validated.data.proposals.filter((proposal) => {
      if (quoteAppearsIn(documentText, proposal.evidenceQuote)) return true;
      warnings.push(
        `Se descartó una propuesta ("${proposal.title}") porque su cita no aparece textualmente en el PDF.`
      );
      return false;
    });

    if (extracted.pages > extracted.readPages) {
      warnings.push(`Se leyeron las primeras ${extracted.readPages} de ${extracted.pages} páginas.`);
    }
    if (extracted.truncated) {
      warnings.push("El texto del PDF se recortó por longitud: puede faltar el final del documento.");
    }

    return NextResponse.json({
      documentKind: validated.data.documentKind,
      documentSummary: validated.data.documentSummary,
      organization: validated.data.organization ?? null,
      authors: validated.data.authors,
      pageCount: extracted.pages,
      proposals,
      warnings,
      model: response.model
    });
  } catch (error) {
    console.error("No se pudo analizar el documento de la reforma", error);
    return NextResponse.json(
      { error: "No se pudo analizar el documento", detail: error instanceof Error ? error.message : undefined },
      { status: 502 }
    );
  }
}
