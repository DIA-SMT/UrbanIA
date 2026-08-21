import "server-only";

import { askUrbanAssistant } from "@/lib/ai/openrouter";

/**
 * Resumen de la transcripción POR TRAMOS, para que el resumen ejecutivo deje de
 * perderse el medio de la audiencia.
 *
 * El problema que resuelve: hasta el 2026-08-21 el material que recibía el
 * redactor eran los primeros 30.000 caracteres de la transcripción, un marcador
 * que decía "[TRAMO INTERMEDIO OMITIDO POR EXTENSIÓN]" y los últimos 30.000.
 * Medido sobre las audiencias reales, eso descartaba entre el 17% y el 38% del
 * contenido —siempre el medio— en 4 de 7 audiencias. Un resumen con membrete
 * municipal que omite el 38% de una audiencia pública no es un resumen pobre:
 * induce a error.
 *
 * Cómo funciona: si la transcripción entra entera, se pasa tal cual (leerla
 * completa siempre es mejor que resumirla dos veces). Si no entra, se parte en
 * tramos, se resume cada uno en paralelo y el redactor recibe esos resúmenes en
 * orden. Así el medio pesa lo mismo que el principio.
 */

/** Hasta acá la transcripción viaja completa: no hace falta gastar llamadas. */
const UMBRAL_DIRECTO = 45_000;
/** Tamaño buscado de cada tramo. Suficiente para que un tramo sea coherente. */
const TAMANO_TRAMO = 18_000;
/** Tope de la respuesta por tramo. Alcanza para no perder planteos. */
const MAX_TOKENS_TRAMO = 1_100;
/** Llamadas simultáneas: evita una ráfaga contra el proveedor. */
const EN_PARALELO = 3;

export type SegmentoTranscripcion = { speakerLabel: string | null; content: string };

export type DigestoTranscripcion = {
  /** Bloque listo para insertar en el material del resumen. */
  material: string;
  /** Cuántos tramos se resumieron. 0 = la transcripción viajó completa. */
  tramos: number;
  /** Caracteres de la transcripción original, antes de resumir. */
  caracteres: number;
  /** Tramos que fallaron y cuyo contenido NO está representado. */
  tramosPerdidos: number;
};

/** Una línea por intervención, con su orador cuando está identificado. */
function lineas(segmentos: SegmentoTranscripcion[]): string[] {
  return segmentos
    .map((s) => `${s.speakerLabel ? `${s.speakerLabel}: ` : ""}${s.content}`.trim())
    .filter((linea) => linea.length > 0);
}

/**
 * Parte una línea más larga que un tramo entero.
 *
 * No es un caso teórico: la audiencia "septimo Concejo deliberante" tiene UN
 * solo segmento de 51.060 caracteres, así que partir únicamente por segmento
 * dejaría un tramo tres veces más grande que el objetivo. Se corta en el final
 * de oración más cercano para no romper una frase al medio.
 */
function partirLinea(linea: string): string[] {
  if (linea.length <= TAMANO_TRAMO) return [linea];

  const partes: string[] = [];
  let resto = linea;

  while (resto.length > TAMANO_TRAMO) {
    const ventana = resto.slice(0, TAMANO_TRAMO);
    const corte = Math.max(ventana.lastIndexOf(". "), ventana.lastIndexOf("? "), ventana.lastIndexOf("! "));
    // Si no hay final de oración en la ventana, se corta por tamaño: perder el
    // final de una frase es mejor que armar un tramo desmedido.
    const fin = corte > TAMANO_TRAMO * 0.5 ? corte + 1 : TAMANO_TRAMO;
    partes.push(resto.slice(0, fin).trim());
    resto = resto.slice(fin).trim();
  }

  if (resto.length) partes.push(resto);
  return partes;
}

/** Agrupa las líneas en tramos de ~TAMANO_TRAMO sin cortar una intervención. */
function armarTramos(segmentos: SegmentoTranscripcion[]): string[] {
  const tramos: string[] = [];
  let actual: string[] = [];
  let largo = 0;

  for (const linea of lineas(segmentos).flatMap(partirLinea)) {
    if (largo > 0 && largo + linea.length > TAMANO_TRAMO) {
      tramos.push(actual.join("\n"));
      actual = [];
      largo = 0;
    }
    actual.push(linea);
    largo += linea.length + 1;
  }

  if (actual.length) tramos.push(actual.join("\n"));
  return tramos;
}

const INSTRUCCIONES = [
  "Sos analista de la Municipalidad de San Miguel de Tucumán y estás procesando la transcripción de una audiencia pública sobre el Código de Planeamiento Urbano.",
  "Recibís UN TRAMO de la audiencia, no la audiencia completa. No es el principio ni el final necesariamente: es un tramo del medio del debate.",
  "",
  "Tu tarea es dejar registrado TODO lo que se planteó en este tramo, para que después otra persona redacte el resumen ejecutivo con esto y con los demás tramos.",
  "",
  "Reglas:",
  "- NO es un resumen ejecutivo ni un texto para publicar: es material de trabajo. No escribas introducción ni cierre.",
  "- Registrá cada planteo con QUIÉN lo hizo, cuando la transcripción lo identifique. Si no está identificado, decí 'un participante'.",
  "- Conservá los datos concretos tal como aparecen: cifras, alturas, porcentajes, calles, barrios, números de artículo, ordenanzas, plazos y nombres de áreas.",
  "- Registrá los pedidos, las objeciones y los compromisos asumidos, incluso si se mencionan al pasar.",
  "- Si un planteo queda a mitad porque el tramo se corta, dejalo anotado igual.",
  "- No interpretes ni opines. No completes lo que no está dicho.",
  "- Si el tramo no tiene contenido sustantivo (saludos, cuestiones de orden, problemas de audio), decilo en una línea y no inventes.",
  "",
  "Formato: viñetas con guion, una por planteo. Sin encabezados ni conclusiones."
];

/** Resume un tramo. Devuelve null si el modelo no responde tras un reintento. */
async function resumirTramo(tramo: string, indice: number, total: number, model: string): Promise<string | null> {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const respuesta = await askUrbanAssistant(
        [
          { role: "system", content: INSTRUCCIONES.join("\n") },
          {
            role: "user",
            content: `TRAMO ${indice + 1} DE ${total} DE LA AUDIENCIA:\n\n${tramo}`
          }
        ],
        { model, maxTokens: MAX_TOKENS_TRAMO, temperature: 0.1 }
      );
      const texto = respuesta.answer.trim();
      if (texto.length > 40) return texto;
    } catch (error) {
      console.warn(
        `Resumen por tramos: falló el tramo ${indice + 1}/${total} (intento ${intento + 1}).`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return null;
}

export async function digestTranscript(
  segmentos: SegmentoTranscripcion[],
  options: { model?: string } = {}
): Promise<DigestoTranscripcion> {
  const completa = lineas(segmentos).join("\n");

  if (completa.length === 0) {
    return { material: "", tramos: 0, caracteres: 0, tramosPerdidos: 0 };
  }

  // Entra completa: se pasa tal cual. Leer la transcripción real siempre le da
  // al redactor más que leer un resumen de un resumen.
  if (completa.length <= UMBRAL_DIRECTO) {
    return {
      material: `TRANSCRIPCIÓN COMPLETA DE LA AUDIENCIA:\n${completa}`,
      tramos: 0,
      caracteres: completa.length,
      tramosPerdidos: 0
    };
  }

  const tramos = armarTramos(segmentos);
  // El tramo es extracción, no redacción: alcanza el modelo barato y así sumar
  // cobertura no multiplica el costo del documento.
  const model = options.model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const resumenes: (string | null)[] = [];
  for (let desde = 0; desde < tramos.length; desde += EN_PARALELO) {
    const tanda = await Promise.all(
      tramos
        .slice(desde, desde + EN_PARALELO)
        .map((tramo, i) => resumirTramo(tramo, desde + i, tramos.length, model))
    );
    resumenes.push(...tanda);
  }

  const perdidos = resumenes.filter((r) => r === null).length;

  /*
   * Los tramos que fallaron se DECLARAN en el material, no se omiten en
   * silencio. Si el redactor no sabe que le falta un tramo, escribe un documento
   * que se presenta como completo cuando no lo es: es exactamente el error que
   * este módulo vino a corregir, movido un paso más adelante.
   */
  const cuerpo = resumenes
    .map((resumen, i) =>
      resumen
        ? `--- TRAMO ${i + 1} DE ${tramos.length} ---\n${resumen}`
        : `--- TRAMO ${i + 1} DE ${tramos.length}: NO SE PUDO PROCESAR ---\nEste tramo de la audiencia no está representado en el material. No afirmes ni niegues nada sobre lo tratado en él.`
    )
    .join("\n\n");

  const encabezado = [
    `TRANSCRIPCIÓN DE LA AUDIENCIA, RESUMIDA EN ${tramos.length} TRAMOS EN ORDEN CRONOLÓGICO.`,
    "Cada tramo cubre una parte del debate. La audiencia está representada COMPLETA: no hay tramos omitidos por extensión.",
    perdidos > 0
      ? `ATENCIÓN: ${perdidos} de ${tramos.length} tramos no se pudieron procesar y están marcados abajo.`
      : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    material: `${encabezado}\n\n${cuerpo}`,
    tramos: tramos.length,
    caracteres: completa.length,
    tramosPerdidos: perdidos
  };
}
