/**
 * Taxonomía de temas, derivada del Código de Planeamiento Urbano real (Ordenanza
 * 2648/98, texto ordenado a mayo de 2014).
 *
 * Los ejes anteriores (Ambiente, Movilidad, Espacio público) estaban inventados: el
 * CPU no tiene capítulos de movilidad ni de ambiente. Sus capítulos sustantivos son
 * zonificación (III), usos del suelo (IV), edificación (V y VI) y situaciones
 * especiales (VII). Los capítulos I, II, VIII y IX son administrativos (alcances,
 * definiciones, penalidades, derogación): se pueden consultar, pero no sirven para
 * clasificar el reclamo de un vecino.
 *
 * FUERA_DE_ALCANCE existe porque es la verdad más útil del sistema: la mayoría de
 * los reclamos ciudadanos (basura, arbolado, luminarias, veredas rotas) NO los
 * regula el CPU. Marcarlos así le dice al equipo municipal, de un vistazo, qué
 * entra por el Código y qué es un problema de servicio urbano que se resuelve por
 * otra vía.
 */

export type CpuTopic = {
  id: string;
  label: string;
  /** Qué resuelve el tema, en lenguaje de vecino. */
  summary: string;
  /** Capítulos del CPU que lo componen. Vacío = el Código no lo regula. */
  chapters: string[];
  /** Palabras que un vecino usaría para hablar de esto. Guían al clasificador. */
  hints: string[];
};

export const CPU_TOPICS: CpuTopic[] = [
  {
    id: "zonificacion",
    label: "Zonificacion y distritos",
    summary: "Que distrito rige en cada zona de la ciudad, como se delimitan y que caracter tiene cada uno.",
    chapters: ["III"],
    hints: ["distrito", "zona", "zonificacion", "C2", "R1", "area especial", "delimitacion", "barrio residencial"]
  },
  {
    id: "usos-del-suelo",
    label: "Usos del suelo",
    summary: "Que actividades se pueden desarrollar en cada distrito y bajo que condiciones.",
    chapters: ["IV"],
    hints: ["uso", "actividad", "comercio", "habilitacion", "local", "fabrica", "deposito", "boliche", "rubro"]
  },
  {
    id: "edificacion",
    label: "Edificacion",
    summary: "Alturas, retiros, patios, espacio urbano y parametros para construir.",
    chapters: ["V", "VI"],
    hints: ["altura", "retiro", "patio", "edificio", "construccion", "obra", "medianera", "balcon", "fot", "fos"]
  },
  {
    id: "situaciones-especiales",
    label: "Situaciones especiales",
    summary: "Countries, parcelas grandes, edificios patrimoniales y equipamiento urbano.",
    chapters: ["VII"],
    hints: ["country", "patrimonio", "patrimonial", "equipamiento", "parcela grande", "urbanizacion cerrada"]
  }
];

/** El CPU no lo regula: reclamos de servicio urbano. Se resuelven por otra via. */
export const OUT_OF_SCOPE_TOPIC: CpuTopic = {
  id: "fuera-de-alcance",
  label: "Fuera del alcance del CPU",
  summary: "Servicios urbanos que el Codigo de Planeamiento no regula: arbolado, basura, luminarias, veredas, transito.",
  chapters: [],
  hints: ["basura", "arbolado", "luminaria", "luz", "vereda rota", "bache", "transito", "colectivo", "plaza abandonada", "ruido"]
};

export type TopicRelation = {
  /** El reclamo, como lo diria un vecino. */
  subject: string;
  /** Tema del CPU con el que se relaciona. */
  topic: string;
  /** Por que se relaciona. Verificado contra el texto real del Codigo. */
  why: string;
};

/**
 * Puentes entre un reclamo que el CPU no regula y el tema del Codigo que sí lo roza.
 * Que el Código no regule la recolección de basura no significa que no diga nada
 * sobre residuos: dice dónde puede localizarse una planta de transferencia.
 *
 * Cada relación se verificó buscando el término en el texto de los 52 artículos.
 * No agregar ninguna sin comprobar que el artículo dice lo que se afirma.
 */
export const OUT_OF_SCOPE_RELATIONS: TopicRelation[] = [
  {
    subject: "arbolado, vegetacion y espacios verdes",
    topic: "Edificacion",
    why: "los Articulos 5 y 23 incluyen la vegetacion como elemento coadyuvante del saneamiento ambiental al definir el espacio urbano"
  },
  {
    subject: "arbolado en urbanizaciones cerradas",
    topic: "Situaciones especiales",
    why: "el Articulo 39 obliga a parquizar y arbolar toda la extension en las urbanizaciones country"
  },
  {
    subject: "residuos",
    topic: "Usos del suelo",
    why: "el Articulo 20 fija en que distritos puede localizarse la transferencia y seleccion de residuos solidos urbanos; regula donde se instala la planta, no la recoleccion domiciliaria"
  },
  {
    subject: "veredas",
    topic: "Edificacion",
    why: "los Articulos 5, 25 y 30 definen la acera y la usan como referencia de la linea municipal, los retiros y los voladizos; regulan la geometria, no el mantenimiento ni la reparacion"
  },
  {
    subject: "plazas y equipamiento barrial",
    topic: "Situaciones especiales",
    why: "el Articulo 42 trata las edificaciones destinadas a equipamiento urbano y servicios comunitarios"
  }
];

/**
 * Falsos amigos: palabras del reclamo que matchean el Codigo pero significan otra
 * cosa. Sin esta advertencia el retrieval por palabra clave cita con total confianza
 * un articulo que no tiene nada que ver.
 */
export const FALSE_FRIENDS = [
  "Iluminacion y alumbrado publico: cuando el CPU habla de iluminacion (Articulos 5, 23, 24, 25, 26 y 27) se refiere a la iluminacion NATURAL de locales habitables y al asoleamiento. NO regula el alumbrado publico. Un reclamo por luminarias apagadas o una plaza sin luz de noche NO tiene ninguna relacion con esos articulos ni con el tema Edificacion: no los cites y no declares una relacion.",
  "Ruido: el CPU menciona la acustica como condicion de habitabilidad de los locales. No regula el ruido molesto en la via publica ni los horarios nocturnos, y no hay relacion que declarar.",
  "Plaza: el Articulo 1 usa 'emplazamiento' y el 47 'plazo'. No confundas esas palabras con una plaza publica.",
  "Mantenimiento: que el Codigo defina o mencione algo (la acera, el espacio urbano, el equipamiento) no significa que regule su mantenimiento, su reparacion ni su limpieza. Definir no es mantener."
];

export const ALL_TOPICS: CpuTopic[] = [...CPU_TOPICS, OUT_OF_SCOPE_TOPIC];

/** Etiqueta de un aporte que todavía nadie clasificó. */
export const UNCLASSIFIED_AXIS = "Sin clasificar";

/** Etiquetas asignables por el equipo municipal al revisar un aporte. */
export const ASSIGNABLE_AXES = ALL_TOPICS.map((topic) => topic.label);

export function isClassified(axis: string) {
  return Boolean(axis) && axis !== UNCLASSIFIED_AXIS;
}

export function topicByLabel(label: string) {
  return ALL_TOPICS.find((topic) => topic.label === label) ?? null;
}

/** true si el tema no lo regula el CPU: se muestra distinto y no se le exige normativa. */
export function isOutOfScope(label: string) {
  return label === OUT_OF_SCOPE_TOPIC.label;
}
