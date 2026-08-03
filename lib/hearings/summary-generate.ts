import { askUrbanAssistant } from "@/lib/ai/openrouter";
import type { SummaryPayload, SummarySection } from "@/lib/hearings/summary-document";

/**
 * Generación del resumen ejecutivo en DOS pasadas: primero el esqueleto del
 * documento (cobertura completa del material), después cada sección redactada
 * EN PARALELO con toda la atención del modelo puesta en ella. Un solo prompt
 * que redacte todo produce secciones de un párrafo con relleno genérico
 * (verificado 2026-08-03 contra el resumen de la Comisión FAU hecho a mano);
 * por partes, cada sección sale con la densidad de un documento profesional.
 *
 * Sin imports de servidor a propósito: los scripts de verificación pueden
 * ejercitar la generación completa sin sesión.
 */

const SYSTEM_PROMPT = [
  "Sos el equipo de redacción de la Dirección de Inteligencia Artificial de la Municipalidad de San Miguel de Tucumán.",
  "Redactás resúmenes ejecutivos institucionales de audiencias públicas para jefaturas, secretarías e Intendencia.",
  "El lector no es técnico: explicá qué ocurrió, qué problema se planteó, qué evidencia se presentó, qué impacto tiene para la ciudadanía y qué información útil deja al Municipio.",
  "Escribí en prosa, con oraciones completas, cortas y concretas. No menciones stacks, endpoints, modelos, librerías ni procesos internos del sistema.",
  "Basate únicamente en la transcripción, los documentos y los datos expresamente provistos. Si un dato no está verificado en ese material, no lo pongas. Nunca inventes datos."
].join(" ");

const DENSITY_RULES = [
  "REGLAS EDITORIALES (obligatorias):",
  "- Cada párrafo debe aportar información ESPECÍFICA del material: cifras con su valor exacto, ordenanzas y decretos con su número, estudios con autor y año, programas e institutos con su nombre o sigla, lugares concretos.",
  "- PROHIBIDO el relleno: nada de 'se destacó la importancia de', 'se abordaron diversos temas', 'se hizo hincapié en', 'se analizaron las tendencias'. Escribí QUÉ se dijo, con sus datos y consecuencias.",
  "- Si el material ofrece un razonamiento (causa → consecuencia), reconstruilo completo; no lo reduzcas a una mención.",
  "- Basate EXCLUSIVAMENTE en el material provisto. Si un dato no está, no existe.",
  "- Evitá lenguaje técnico y administrativo innecesario. Traducí cada hallazgo a su consecuencia práctica para la ciudadanía o para la gestión municipal.",
  "- No repitas una misma idea en la bajada, las secciones, las líneas de acción y el cierre."
].join("\n");

type OutlineSection = { titulo: string; foco: string; subsecciones?: string[] };

type Outline = {
  titulo: string;
  bajada: string;
  deQueSeTrata: string;
  expositor: string;
  destinatario: string;
  estructura: string;
  secciones: OutlineSection[];
  lineasDeAccion: string[];
  enSintesis: string;
};

const OUTLINE_CONTRACT = [
  "Tu tarea AHORA es SOLO el esqueleto del documento (la redacción viene después, sección por sección).",
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "bajada": "...", "deQueSeTrata": "...", "expositor": "...", "destinatario": "...", "estructura": "I. ... · II. ...", "secciones": [{"titulo": "...", "foco": "qué debe cubrir esta sección y con qué datos concretos del material"}], "lineasDeAccion": ["..."], "enSintesis": "..."}`,
  "- titulo: editorial, fiel al contenido central y de hasta 90 caracteres.",
  "- bajada: una sola oración de hasta 180 caracteres que permita entender el asunto y su relevancia pública.",
  "- deQueSeTrata: un único párrafo de 3 a 4 oraciones breves. Explicá el propósito de la audiencia, el problema tratado y qué información deja para la decisión municipal.",
  "- expositor: nombre y rol sólo si constan en el material; si no, indicá 'No identificado en el material'.",
  "- destinatario: el área, autoridad o ámbito al que se dirige lo expuesto; si no consta, indicá 'Equipo municipal responsable'.",
  "- secciones: EXACTAMENTE 4, cubriendo el material sin superposiciones. El 'foco' debe nombrar datos, cifras y referencias concretas disponibles para esa sección.",
  "- lineasDeAccion: entre 3 y 5 medidas o decisiones que surjan expresamente del material. No conviertas una opinión general en una recomendación inventada.",
  "- enSintesis: cierre de 2 o 3 oraciones, sin viñetas, que reúna el hallazgo central y su consecuencia para la gestión. No agregues información nueva.",
  DENSITY_RULES
].join("\n");

const SECTION_CONTRACT = [
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "parrafos": ["...", "..."], "destacados": ["..."], "datos": [{"valor": "65 %", "descripcion": "..."}]}`,
  "- parrafos: EXACTAMENTE 2. Cada uno debe tener entre 2 y 4 oraciones cortas y el bloque completo no debe superar 950 caracteres.",
  "- El primer párrafo explica la evidencia o planteo. El segundo explica su consecuencia concreta para la ciudadanía o la gestión municipal.",
  "- datos: hasta 2 cifras potentes del bloque (valor corto + descripción de una línea). Usalos sólo cuando el material ofrezca un valor exacto.",
  "- destacados: como máximo 1 frase textual breve o hallazgo formulado con fuerza. Omitilo si no existe evidencia suficiente.",
  "- Los campos destacados y datos son opcionales. No agregues subsecciones ni tablas.",
  DENSITY_RULES
].join("\n");

function parseJson<T>(raw: string): T {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(clean) as T;
  } catch {
    // Algunos proveedores agregan una frase antes o después del objeto aun
    // cuando se pide JSON mode. Recuperamos únicamente el objeto exterior.
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(clean.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error("La respuesta no contiene un objeto JSON válido");
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown, max = Number.POSITIVE_INFINITY): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeOutline(value: unknown): { outline: Outline | null; issue: string } {
  if (!value || typeof value !== "object") return { outline: null, issue: "el esqueleto no es un objeto" };
  const source = value as Record<string, unknown>;
  const rawSections = Array.isArray(source.secciones) ? source.secciones : [];
  const sections = rawSections
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const titulo = text(raw.titulo);
      const foco = text(raw.foco);
      if (!titulo || !foco) return null;
      const subsecciones = textList(raw.subsecciones, 4);
      return { titulo, foco, ...(subsecciones.length ? { subsecciones } : {}) } satisfies OutlineSection;
    })
    .filter((section): section is OutlineSection => section !== null);

  if (sections.length !== 4) {
    return { outline: null, issue: `se recibieron ${sections.length} secciones válidas en lugar de 4` };
  }

  const lineasDeAccion = textList(source.lineasDeAccion, 5);
  const titulo = text(source.titulo);
  const bajada = text(source.bajada);
  const deQueSeTrata = text(source.deQueSeTrata);
  const enSintesis = text(source.enSintesis);
  if (!titulo || !bajada || !deQueSeTrata || !enSintesis) {
    return { outline: null, issue: "faltan campos editoriales obligatorios" };
  }
  if (!lineasDeAccion.length) {
    return { outline: null, issue: "no se recibió ninguna línea de acción verificable" };
  }

  const roman = ["I", "II", "III", "IV"];
  return {
    outline: {
      titulo,
      bajada,
      deQueSeTrata,
      expositor: text(source.expositor) || "No identificado en el material",
      destinatario: text(source.destinatario) || "Equipo municipal responsable",
      estructura:
        text(source.estructura) || sections.map((section, index) => `${roman[index]}. ${section.titulo}`).join(" · "),
      secciones: sections,
      lineasDeAccion,
      enSintesis
    },
    issue: ""
  };
}

async function generateOutline(material: string, model: string): Promise<Outline> {
  let lastIssue = "respuesta vacía";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const correction =
        attempt === 0
          ? ""
          : `\n\nCORRECCIÓN OBLIGATORIA: el intento anterior fue inválido porque ${lastIssue}. Devolvé nuevamente el objeto completo, con exactamente 4 secciones.`;
      const response = await askUrbanAssistant(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${material}\n\n${OUTLINE_CONTRACT}${correction}` }
        ],
        { json: true, maxTokens: 1800, temperature: 0.2, model }
      );
      const normalized = normalizeOutline(parseJson<unknown>(response.answer));
      if (normalized.outline) return normalized.outline;
      lastIssue = normalized.issue;
    } catch (error) {
      lastIssue = error instanceof Error ? error.message : "respuesta inválida";
    }

    console.warn(`Resumen: intento ${attempt + 1} de esqueleto inválido (${lastIssue}).`);
  }

  throw new Error(`No se pudo obtener el esqueleto institucional después de 3 intentos: ${lastIssue}`);
}

function normalizeSection(value: unknown, fallbackTitle: string): SummarySection | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const paragraphs = textList(source.parrafos);
  if (!paragraphs.length) return null;

  // No descartamos contenido si el modelo devuelve más de dos párrafos: los
  // restantes se consolidan en el segundo bloque, respetando el límite visual.
  const parrafos = paragraphs.length <= 2 ? paragraphs : [paragraphs[0], paragraphs.slice(1).join(" ")];
  const destacados = textList(source.destacados, 1);
  const datos = Array.isArray(source.datos)
    ? source.datos
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as Record<string, unknown>;
          const valor = text(raw.valor);
          const descripcion = text(raw.descripcion);
          return valor && descripcion ? { valor, descripcion } : null;
        })
        .filter((item): item is { valor: string; descripcion: string } => item !== null)
        .slice(0, 2)
    : [];

  return {
    titulo: text(source.titulo) || fallbackTitle,
    parrafos,
    ...(destacados.length ? { destacados } : {}),
    ...(datos.length ? { datos } : {})
  };
}

async function generateSection(
  material: string,
  outline: Outline,
  section: OutlineSection,
  index: number,
  model: string
): Promise<SummarySection | null> {
  const siblings = outline.secciones
    .map((other, otherIndex) => `${otherIndex + 1}. ${other.titulo}`)
    .join(" · ");

  const brief = [
    `Estás redactando SOLO la sección ${index + 1} de un resumen ejecutivo titulado "${outline.titulo}".`,
    `SECCIÓN A REDACTAR: "${section.titulo}".`,
    `FOCO: ${section.foco}`,
    section.subsecciones?.length ? `SUBSECCIONES SUGERIDAS: ${section.subsecciones.join(" · ")}` : null,
    `Las demás secciones del documento son: ${siblings}. NO repitas su contenido: si un dato pertenece claramente a otra sección, no lo desarrolles acá.`
  ]
    .filter(Boolean)
    .join("\n");

  let lastIssue = "respuesta vacía";
  let oneParagraphFallback: SummarySection | null = null;

  // Dos reintentos corrigen JSON incompleto o contratos mal respetados. Si el
  // último intento trae un único párrafo sustantivo, se conserva: es preferible
  // un bloque más breve y verificable a abortar todo el PDF.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const correction =
        attempt === 0
          ? ""
          : `\n\nCORRECCIÓN OBLIGATORIA: el intento anterior fue inválido porque ${lastIssue}. Devolvé el objeto completo y exactamente 2 párrafos.`;
      const response = await askUrbanAssistant(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${material}\n\n${brief}\n\n${SECTION_CONTRACT}${correction}` }
        ],
        { json: true, maxTokens: 1800, temperature: 0.2, model }
      );
      const normalized = normalizeSection(parseJson<unknown>(response.answer), section.titulo);
      if (!normalized) {
        lastIssue = "faltan párrafos válidos";
      } else if (normalized.parrafos.length >= 2) {
        return normalized;
      } else {
        oneParagraphFallback = normalized;
        lastIssue = "se recibió 1 párrafo en lugar de 2";
      }
    } catch (error) {
      lastIssue = error instanceof Error ? error.message : "respuesta inválida";
    }

    console.warn(`Resumen: intento ${attempt + 1} inválido para "${section.titulo}" (${lastIssue}).`);
  }

  if (oneParagraphFallback) {
    console.warn(`Resumen: se usa una versión abreviada de "${section.titulo}" después de 3 intentos.`);
    return oneParagraphFallback;
  }

  console.error(`Resumen: falló la sección "${section.titulo}" después de 3 intentos (${lastIssue}).`);
  return null;
}

/** Genera el resumen completo: esqueleto + secciones en paralelo. */
export async function generateSummary(material: string, options: { model?: string } = {}): Promise<SummaryPayload> {
  const model = options.model || process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o";

  const outline = await generateOutline(material, model);

  // Dos secciones por tanda evitan una ráfaga de cuatro prompts extensos contra
  // el proveedor. Cada sección conserva sus propios reintentos y diagnóstico.
  const sections: (SummarySection | null)[] = [];
  for (let offset = 0; offset < outline.secciones.length; offset += 2) {
    const batch = await Promise.all(
      outline.secciones
        .slice(offset, offset + 2)
        .map((section, batchIndex) => generateSection(material, outline, section, offset + batchIndex, model))
    );
    sections.push(...batch);
  }
  const written = sections.filter((section): section is SummarySection => section !== null);
  if (written.length !== 4) {
    throw new Error(`El resumen quedó incompleto: se redactaron ${written.length} de 4 secciones`);
  }

  return {
    titulo: outline.titulo,
    bajada: outline.bajada,
    deQueSeTrata: outline.deQueSeTrata,
    expositor: outline.expositor,
    destinatario: outline.destinatario,
    estructura: outline.estructura,
    secciones: written,
    lineasDeAccion: outline.lineasDeAccion,
    enSintesis: outline.enSintesis
  };
}
