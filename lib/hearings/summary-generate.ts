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

function outlineContract(objetivo: number): string {
  return [
  "Tu tarea AHORA es SOLO el esqueleto del documento (la redacción viene después, sección por sección).",
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "bajada": "...", "deQueSeTrata": "...", "expositor": "...", "destinatario": "...", "estructura": "I. ... · II. ...", "secciones": [{"titulo": "...", "foco": "qué debe cubrir esta sección y con qué datos concretos del material"}], "lineasDeAccion": ["..."], "enSintesis": "..."}`,
  "- titulo: editorial, fiel al contenido central y de hasta 90 caracteres.",
  "- bajada: una sola oración de hasta 180 caracteres que permita entender el asunto y su relevancia pública.",
  "- deQueSeTrata: un único párrafo de 3 a 4 oraciones breves. Explicá el propósito de la audiencia, el problema tratado y qué información deja para la decisión municipal.",
  "- expositor: nombre y rol sólo si constan en el material; si no, indicá 'No identificado en el material'.",
  "- destinatario: el área, autoridad o ámbito al que se dirige lo expuesto; si no consta, indicá 'Equipo municipal responsable'.",
  `- secciones: EXACTAMENTE ${objetivo}, cubriendo el material sin superposiciones. El 'foco' debe nombrar datos, cifras y referencias concretas disponibles para esa sección.`,
  "- Una sección por eje temático realmente tratado en la audiencia. Si se discutieron alturas, usos del suelo, movilidad, espacio público y patrimonio, cada uno merece la suya: no las agrupes en 'varios temas'.",
  "- Recorré el material COMPLETO al repartir las secciones. Cuando el material viene en tramos numerados, los del medio tienen que estar representados igual que el primero y el último.",
  "- lineasDeAccion: entre 3 y 5 medidas o decisiones que surjan expresamente del material. No conviertas una opinión general en una recomendación inventada.",
  "- enSintesis: cierre de 2 o 3 oraciones, sin viñetas, que reúna el hallazgo central y su consecuencia para la gestión. No agregues información nueva.",
  DENSITY_RULES
  ].join("\n");
}

const SECTION_CONTRACT = [
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "parrafos": ["...", "...", "..."], "destacados": ["..."], "datos": [{"valor": "65 %", "descripcion": "..."}]}`,
  /*
   * Antes eran EXACTAMENTE 2 parrafos y 950 caracteres. Con eso el cuerpo entero
   * del documento media ~3.800 caracteres, para audiencias de hasta 97.000: el
   * resumen se leia pobre porque no habia lugar para lo que se habia dicho. Cada
   * seccion pasa a ocupar una pagina propia, asi que el presupuesto sube a ~2.600.
   */
  "- parrafos: entre 3 y 4. Cada uno de 3 a 5 oraciones, y el bloque completo entre 1.800 y 2.600 caracteres. Es una pagina entera del documento: si escribís 900 caracteres, la página queda medio vacía.",
  "- El primero presenta el planteo con sus datos. Los del medio desarrollan la evidencia, quién lo sostuvo y qué se discutió. El último explica la consecuencia concreta para la ciudadanía o la gestión municipal.",
  "- Nombrá a quien planteó cada cosa cuando el material lo identifique, y citá las cifras, calles, barrios, artículos y ordenanzas tal como aparecen. Es lo que distingue un resumen útil de una generalidad.",
  "- No rellenes. Si el material de esta sección no alcanza para 1.800 caracteres, escribí lo que haya con precisión y cerrá: es mejor una sección corta y concreta que tres párrafos de vaguedades.",
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

function normalizeOutline(value: unknown, objetivo: number): { outline: Outline | null; issue: string } {
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

  /*
   * Se acepta un margen en vez de exigir el numero exacto: si el material no da
   * para el objetivo, una seccion menos es mejor que forzar una de relleno, y
   * descartar el esqueleto entero por eso hacia fallar el documento completo.
   * Menos de la mitad del objetivo si es un fallo real de formato.
   */
  const minimo = Math.max(3, objetivo - 2);
  if (sections.length < minimo) {
    return {
      outline: null,
      issue: `se recibieron ${sections.length} secciones válidas y se esperaban ${objetivo} (mínimo aceptable ${minimo})`
    };
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

async function generateOutline(material: string, model: string, objetivo: number): Promise<Outline> {
  let lastIssue = "respuesta vacía";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const correction =
        attempt === 0
          ? ""
          : `\n\nCORRECCIÓN OBLIGATORIA: el intento anterior fue inválido porque ${lastIssue}. Devolvé nuevamente el objeto completo, con ${objetivo} secciones.`;
      const response = await askUrbanAssistant(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${material}\n\n${outlineContract(objetivo)}${correction}` }
        ],
        // Mas secciones necesitan mas tokens de esqueleto: con 1800 el JSON de
        // diez secciones se cortaba al medio y el intento se descartaba entero.
        { json: true, maxTokens: 3200, temperature: 0.2, model }
      );
      const normalized = normalizeOutline(parseJson<unknown>(response.answer), objetivo);
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

  /*
   * Hasta 4 parrafos, y lo que pase se consolida en el ultimo para no descartar
   * contenido.
   *
   * Antes el tope era 2 --escrito cuando el contrato pedia "EXACTAMENTE 2"-- y
   * fusionaba el resto en el segundo bloque. Al subir el presupuesto a 3 o 4
   * parrafos, esa fusion anulaba la instruccion en silencio: el modelo devolvia
   * cuatro y el documento mostraba dos de ~1.200 caracteres cada uno, que es un
   * muro de texto. Medido: 6 secciones, todas con 2 parrafos, pese a pedir 3 o 4.
   */
  const MAX_PARRAFOS = 4;
  const parrafos =
    paragraphs.length <= MAX_PARRAFOS
      ? paragraphs
      : [...paragraphs.slice(0, MAX_PARRAFOS - 1), paragraphs.slice(MAX_PARRAFOS - 1).join(" ")];
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
/**
 * Cuántas secciones pedirle al documento, según cuánto material haya.
 *
 * Antes eran 4 fijas, sin importar si la audiencia había durado veinte minutos o
 * cuatro horas: el cuerpo del documento medía siempre ~3.800 caracteres. Ahora
 * escala, con tope en 10 para no volver ilegible el resumen ni hacer un
 * documento de veinte páginas que nadie lee.
 */
export function seccionesObjetivo(material: string): number {
  const largo = material.length;
  if (largo < 6_000) return 4;
  if (largo < 12_000) return 5;
  if (largo < 20_000) return 6;
  if (largo < 30_000) return 8;
  return 10;
}

export async function generateSummary(material: string, options: { model?: string } = {}): Promise<SummaryPayload> {
  const model = options.model || process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o";
  const objetivo = seccionesObjetivo(material);

  const outline = await generateOutline(material, model, objetivo);

  // Dos secciones por tanda evitan una ráfaga de prompts extensos contra el
  // proveedor. Cada sección conserva sus propios reintentos y diagnóstico.
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
  /*
   * Se exige que TODAS las secciones del esqueleto se hayan redactado, no un
   * numero fijo. Una seccion que falla y se descarta en silencio deja un hueco
   * tematico en el documento sin que nadie lo note: si el esqueleto dijo que
   * habia diez ejes, el documento tiene que cubrir los diez.
   */
  if (written.length !== outline.secciones.length) {
    throw new Error(
      `El resumen quedó incompleto: se redactaron ${written.length} de ${outline.secciones.length} secciones`
    );
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
