/**
 * Filtro de agresiones para los dos canales abiertos al vecino: el chat de Migue y
 * el formulario de propuestas/reclamos.
 *
 * Criterio: bloquea el insulto, no la bronca. Un reclamo legítimo escrito con enojo
 * ("es un desastre", "esto es una vergüenza", "hace años que no viene nadie") tiene
 * que pasar: es exactamente lo que el municipio necesita escuchar. Se corta el
 * insulto dirigido, la vulgaridad y la amenaza.
 *
 * Deliberadamente NO se filtran palabras como "basura", "rata", "chorro", "ladron"
 * o "corrupto": son el vocabulario cotidiano de un reclamo urbano honesto ("se junta
 * basura", "hay ratas en el basural") y bloquearlas dejaría a un vecino sin poder
 * presentar su reclamo. Ante la duda se deja pasar: silenciar una queja legítima es
 * peor que dejar pasar un insulto que el equipo municipal puede ignorar.
 *
 * La detección es léxica y determinista a propósito: no cuesta tokens, no agrega
 * latencia y no depende de que un modelo esté disponible para poder reclamar.
 */

/** Insultos dirigidos y vulgaridad, en español rioplatense. Se comparan por palabra completa. */
const ABUSIVE_TERMS = [
  // Insultos dirigidos
  "puto",
  "puta",
  "putos",
  "putas",
  "pelotudo",
  "pelotuda",
  "pelotudos",
  "pelotudas",
  "boludo",
  "boluda",
  "boludos",
  "boludas",
  "forro",
  "forra",
  "forros",
  "sorete",
  "soretes",
  "conchudo",
  "conchuda",
  "mogolico",
  "mongolico",
  "tarado",
  "tarada",
  "tarados",
  "imbecil",
  "imbeciles",
  "idiota",
  "idiotas",
  "estupido",
  "estupida",
  "estupidos",
  "cretino",
  "cretinos",
  "hdp",
  // Vulgaridad
  "mierda",
  "carajo",
  "verga",
  // Frases agresivas
  "hijo de puta",
  "hija de puta",
  "hijos de puta",
  "la concha de tu madre",
  "andate a la mierda",
  "vayan a la mierda",
  "negro de mierda",
  "muerto de hambre",
  "que se pudran"
];

/** Amenazas: se bloquean siempre, aunque no haya insulto. */
const THREAT_PATTERNS = [
  /\bte\s+(voy|vamos)\s+a\s+(matar|cagar a palos|reventar|romper)/u,
  /\b(los|las)\s+vamos\s+a\s+(matar|reventar|quemar)/u,
  /\bvoy\s+a\s+(prender fuego|quemar|reventar)\b/u,
  /\bmerec[e]n?\s+(morir|la muerte)/u,
  /\bhay\s+que\s+(matarlos|colgarlos|quemarlos)\b/u
];

export type ModerationVerdict = {
  blocked: boolean;
  /** Término o patrón que disparó el bloqueo. Para logs, nunca para mostrar al vecino. */
  matched?: string;
  /** Mensaje listo para mostrar, ya redactado en tono cordial. */
  message?: string;
};

export const CHAT_BLOCK_MESSAGE =
  "Para poder ayudarte necesito que lo escribas sin agravios. Contame el problema con tus palabras: podes ser durisimo con la gestion, el servicio o el estado de la ciudad; lo que no entra son las descalificaciones a una persona.";

export const CONTRIBUTION_BLOCK_MESSAGE =
  "Tu aporte no se guardo porque incluye un agravio personal. Reescribilo apuntando al problema y no a la persona: no hace falta suavizar el reclamo ni bajar el tono, solo quitar la descalificacion.";

const CHAT_MESSAGE = CHAT_BLOCK_MESSAGE;
const CONTRIBUTION_MESSAGE = CONTRIBUTION_BLOCK_MESSAGE;

/** Quita tildes, baja a minúscula y colapsa repeticiones ("putooooo" -> "putoo" -> "puto"). */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detect(text: string): { matched: string } | null {
  const normalized = normalize(text);

  if (!normalized) {
    return null;
  }

  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { matched: `amenaza:${pattern.source.slice(0, 28)}` };
    }
  }

  for (const term of ABUSIVE_TERMS) {
    // Palabra completa: evita que "puta" matchee "reputacion" o "verga" matchee "verguenza".
    const boundary = new RegExp(`(?:^|\\s)${term.replace(/\s+/g, "\\s+")}(?:$|\\s)`, "u");
    if (boundary.test(normalized)) {
      return { matched: term };
    }
  }

  return null;
}

/** Revisa el mensaje que el vecino le escribe a Migue. */
export function moderateChatMessage(text: string): ModerationVerdict {
  const hit = detect(text);
  return hit ? { blocked: true, matched: hit.matched, message: CHAT_MESSAGE } : { blocked: false };
}

/** Revisa el texto de una propuesta, reclamo o aporte antes de guardarlo. */
export function moderateContribution(text: string): ModerationVerdict {
  const hit = detect(text);
  return hit ? { blocked: true, matched: hit.matched, message: CONTRIBUTION_MESSAGE } : { blocked: false };
}
