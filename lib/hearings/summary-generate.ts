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

const SYSTEM_PROMPT =
  "Sos el equipo de redacción de la Dirección de Inteligencia Artificial de la Municipalidad de San Miguel de Tucumán. Redactás resúmenes ejecutivos institucionales de audiencias públicas técnicas: fieles al material, densos en información específica y en español claro. Nunca inventás datos.";

const DENSITY_RULES = [
  "REGLAS DE DENSIDAD (obligatorias):",
  "- Cada párrafo debe aportar información ESPECÍFICA del material: cifras con su valor exacto, ordenanzas y decretos con su número, estudios con autor y año, programas e institutos con su nombre o sigla, lugares concretos.",
  "- PROHIBIDO el relleno: nada de 'se destacó la importancia de', 'se abordaron diversos temas', 'se hizo hincapié en', 'se analizaron las tendencias'. Escribí QUÉ se dijo, con sus datos y consecuencias.",
  "- Si el material ofrece un razonamiento (causa → consecuencia), reconstruilo completo; no lo reduzcas a una mención.",
  "- Basate EXCLUSIVAMENTE en el material provisto. Si un dato no está, no existe."
].join("\n");

type OutlineSection = { titulo: string; foco: string; subsecciones?: string[] };

type Outline = {
  titulo: string;
  bajada: string;
  expositor: string;
  destinatario: string;
  estructura: string;
  secciones: OutlineSection[];
  lineasDeAccion?: string[];
};

const OUTLINE_CONTRACT = [
  "Tu tarea AHORA es SOLO el esqueleto del documento (la redacción viene después, sección por sección).",
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "bajada": "...", "expositor": "...", "destinatario": "...", "estructura": "I. ... · II. ...", "secciones": [{"titulo": "...", "foco": "qué debe cubrir esta sección y con qué datos concretos del material", "subsecciones": ["...", "..."]}], "lineasDeAccion": ["..."]}`,
  "- titulo: editorial y fiel al contenido central de la exposición.",
  "- secciones: entre 5 y 8, cubriendo TODO el material sin superposiciones: recorrelo tema por tema y asigná cada uno a una sección. El 'foco' debe nombrar los datos, cifras y referencias concretas que esa sección tiene disponibles en el material.",
  "- subsecciones: proponelas (2 a 4) cuando la sección cubra dimensiones, escalas o ejes distintos; omitilas si la sección es simple.",
  "- lineasDeAccion: las propuestas accionables que surgen del material, concretas y completas.",
  DENSITY_RULES
].join("\n");

const SECTION_CONTRACT = [
  "Respondé SOLO con un objeto JSON válido con esta forma exacta:",
  `{"titulo": "...", "parrafos": ["..."], "destacados": ["..."], "datos": [{"valor": "65 %", "descripcion": "..."}], "tabla": {"titulo": "...", "columnas": ["..."], "filas": [["..."]]}, "subsecciones": [{"titulo": "...", "parrafos": ["..."], "destacados": ["..."], "datos": [...], "tabla": {...}}]}`,
  "- parrafos: 2 a 4 en el cuerpo principal (o 1 a 2 si hay subsecciones que llevan el peso), y 2 a 4 por subsección. Párrafos sustanciosos de 3 a 6 oraciones.",
  "- datos: los números más potentes del bloque como cifras destacadas (valor corto + descripción de una línea). Usalos SIEMPRE que el material los ofrezca; entre 2 y 4 por sección si existen.",
  "- tabla: SOLO si el material trae una serie de indicadores comparables; columnas y filas fieles.",
  "- destacados: 1 o 2 frases textuales de la exposición (o hallazgos formulados con fuerza) que merecen resaltarse.",
  "- Campos opcionales (destacados, datos, tabla, subsecciones): omitilos si no corresponden; nunca los inventes.",
  DENSITY_RULES
].join("\n");

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

async function generateOutline(material: string, model: string): Promise<Outline> {
  const response = await askUrbanAssistant(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${material}\n\n${OUTLINE_CONTRACT}` }
    ],
    { json: true, maxTokens: 2200, temperature: 0.25, model }
  );
  const outline = parseJson<Outline>(response.answer);
  if (!outline?.titulo || !Array.isArray(outline.secciones) || outline.secciones.length === 0) {
    throw new Error("Esqueleto sin secciones");
  }
  return outline;
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

  // Un reintento ante JSON inválido; si vuelve a fallar, la sección se pierde
  // pero el documento sobrevive (mejor incompleto que caído).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await askUrbanAssistant(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${material}\n\n${brief}\n\n${SECTION_CONTRACT}` }
        ],
        { json: true, maxTokens: 2800, temperature: 0.25, model }
      );
      const parsed = parseJson<SummarySection>(response.answer);
      if (parsed?.titulo && Array.isArray(parsed.parrafos)) {
        return parsed;
      }
    } catch (error) {
      if (attempt === 1) {
        console.error(`Resumen: falló la sección "${section.titulo}".`, error instanceof Error ? error.message : error);
      }
    }
  }
  return null;
}

/** Genera el resumen completo: esqueleto + secciones en paralelo. */
export async function generateSummary(material: string, options: { model?: string } = {}): Promise<SummaryPayload> {
  const model = options.model || process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o";

  const outline = await generateOutline(material, model);

  const sections = await Promise.all(
    outline.secciones.map((section, index) => generateSection(material, outline, section, index, model))
  );
  const written = sections.filter((section): section is SummarySection => section !== null);
  if (!written.length) {
    throw new Error("Ninguna sección pudo redactarse");
  }

  return {
    titulo: outline.titulo,
    bajada: outline.bajada,
    expositor: outline.expositor,
    destinatario: outline.destinatario,
    estructura: outline.estructura,
    secciones: written,
    lineasDeAccion: outline.lineasDeAccion
  };
}
