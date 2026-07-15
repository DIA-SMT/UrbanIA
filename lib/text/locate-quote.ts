/**
 * Ubica una cita textual dentro de un documento y lo parte en before/match/after
 * para resaltarla en la UI. Primero intenta coincidencia exacta; si falla, tolera
 * diferencias de espacios en blanco. Si no encuentra nada, devuelve todo el texto
 * en `before` sin resaltar (fallback seguro: nunca resaltamos algo que no coincide).
 *
 * Se usa tanto en el servidor (contrato de cita de Migue) como en el cliente
 * (modal de artículos de la Consulta al CPU).
 */
export function locateQuote(content: string, quote: string): { before: string; match: string; after: string } {
  const cleanQuote = quote.trim();

  if (!cleanQuote) {
    return { before: content, match: "", after: "" };
  }

  const exactIndex = content.indexOf(cleanQuote);
  if (exactIndex >= 0) {
    return {
      before: content.slice(0, exactIndex),
      match: content.slice(exactIndex, exactIndex + cleanQuote.length),
      after: content.slice(exactIndex + cleanQuote.length)
    };
  }

  const flexiblePattern = cleanQuote.split(/\s+/).map(escapeRegExp).join("\\s+");
  const flexible = new RegExp(flexiblePattern, "i").exec(content);
  if (flexible) {
    return {
      before: content.slice(0, flexible.index),
      match: flexible[0],
      after: content.slice(flexible.index + flexible[0].length)
    };
  }

  return { before: content, match: "", after: "" };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
