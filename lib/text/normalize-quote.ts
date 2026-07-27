/**
 * Normalizacion para comparar una cita contra el texto de origen.
 *
 * El criterio es el mismo que ya usa el diagnostico normativo para validar que
 * el modelo no invente citas del CPU 2014. Esta es una copia deliberada: la de
 * `lib/projects/diagnosis.ts` es privada y ese archivo no se toca, asi que en
 * vez de refactorizarlo se replica la funcion —son tres lineas— y se deja
 * dicho por que.
 *
 * Colapsa espacios y baja a minusculas: alcanza para que una cita valida
 * sobreviva a las diferencias de espaciado que mete la extraccion de PDF, sin
 * aflojar tanto como para dejar pasar texto inventado.
 */
export function normalizeForQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True si la cita aparece textualmente en el origen (con la normalizacion de arriba). */
export function quoteAppearsIn(source: string, quote: string): boolean {
  const needle = normalizeForQuote(quote);
  if (!needle) return false;
  return normalizeForQuote(source).includes(needle);
}
