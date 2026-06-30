export type ProjectStatus = "Realizado" | "En ejecucion" | "Planificado" | "En analisis";
export type ProjectLayer = "Transporte" | "Espacios verdes" | "Equipamiento" | "Zonificacion" | "Riesgos";
export type ProjectOrigin = "Gabinete" | "Area tecnica" | "Concejo" | "Audiencia publica" | "Cidituc" | "Normativa" | "Caso comparado";

export type UrbanProject = {
  id: string;
  title: string;
  layer: ProjectLayer;
  status: ProjectStatus;
  neighborhood: string;
  author: string;
  responsible: string;
  origin: ProjectOrigin;
  promoterArea: string;
  linkedMeetingId?: string;
  linkedHearingId?: string;
  description: string;
  objective: string;
  impact: string[];
  risks: string[];
  nextSteps: string[];
  votes: number;
  comments: number;
  budget: string;
  timeline: string;
  position: [number, number];
  codeRelation?: string;
  technicalJustification?: string;
  attachedDocuments?: string[];
  reviewStatus?: string;
  aiNormativeImpact?: string;
};

export const urbanProjects: UrbanProject[] = [
  {
    id: "ciclovia-aconquija",
    title: "Nueva ciclovia en Av. Aconquija",
    layer: "Transporte",
    status: "En analisis",
    neighborhood: "Yerba Buena / Oeste",
    author: "Equipo tecnico",
    responsible: "Movilidad Urbana",
    origin: "Area tecnica",
    promoterArea: "Movilidad Urbana",
    linkedMeetingId: "gabinete-2026-06-24",
    linkedHearingId: "aud-ciclovia-aconquija",
    description: "Corredor de movilidad activa con impacto esperado en seguridad vial y conectividad.",
    objective: "Conectar zonas residenciales, equipamiento publico y corredores comerciales con infraestructura segura para bicicletas.",
    impact: ["Mejora de movilidad activa", "Reduccion de viajes cortos en auto", "Mayor seguridad vial"],
    risks: ["Conflictos con estacionamiento", "Necesidad de mantenimiento", "Aceptacion comercial inicial"],
    nextSteps: ["Relevamiento vial", "Consulta institucional", "Anteproyecto tecnico", "Informe de factibilidad"],
    votes: 236,
    comments: 35,
    budget: "Medio",
    timeline: "90 dias de anteproyecto",
    position: [-26.8168, -65.2362],
    codeRelation: "CPU Art. 12, Art. 18 y Art. 24: jerarquia vial, perfiles urbanos y estacionamiento",
    technicalJustification: "El corredor concentra viajes cortos, siniestralidad leve y demanda de conexion con equipamiento educativo y comercial.",
    attachedDocuments: ["Relevamiento vial Aconquija.pdf", "Conteo preliminar de estacionamiento.xlsx", "Mapa de tramos piloto.geojson"],
    reviewStatus: "En revision normativa",
    aiNormativeImpact: "La propuesta es viable como piloto si se delimita por tramos, se preserva carga y descarga comercial y se acompana con audiencia o mesa sectorial previa. Requiere contrastar perfil vial, estacionamiento y seguridad peatonal antes de obra definitiva."
  },
  {
    id: "plaza-barrio-sur",
    title: "Plaza de bolsillo en Barrio Sur",
    layer: "Espacios verdes",
    status: "Planificado",
    neighborhood: "Barrio Sur",
    author: "Gabinete urbano",
    responsible: "Ambiente y Espacio Publico",
    origin: "Gabinete",
    promoterArea: "Ambiente y Espacio Publico",
    linkedMeetingId: "gabinete-2026-06-18",
    linkedHearingId: "aud-arbolado-barrios",
    description: "Intervencion barrial para aumentar cobertura verde y mejorar permanencia peatonal.",
    objective: "Recuperar un lote subutilizado como espacio verde de cercania con sombra, bancos y juegos.",
    impact: ["Aumento de espacios verdes", "Mejora de permanencia barrial", "Mayor actividad comunitaria"],
    risks: ["Disponibilidad dominial", "Costo de mantenimiento", "Seguridad nocturna"],
    nextSteps: ["Validar titularidad", "Cruzar aportes Cidituc", "Diseno preliminar", "Presupuesto"],
    votes: 88,
    comments: 18,
    budget: "Bajo / medio",
    timeline: "60 dias de diseno",
    position: [-26.8354, -65.2172],
    codeRelation: "CPU Art. 29 y Art. 31: espacio publico, veredas, accesibilidad y arbolado urbano",
    technicalJustification: "Barrio Sur presenta baja cobertura de sombra, demanda vecinal recurrente y oportunidad de recuperar suelo subutilizado.",
    attachedDocuments: ["Inventario lotes Barrio Sur.xlsx", "Mapa deficit sombra.pdf", "Aportes Cidituc plaza bolsillo.csv"],
    reviewStatus: "Apta para escenario",
    aiNormativeImpact: "El caso puede avanzar como intervencion de bajo riesgo si se valida dominio del suelo y mantenimiento. Conviene vincularlo con el programa de veredas y arbolado para evitar una plaza aislada sin continuidad peatonal."
  },
  {
    id: "centro-comunitario",
    title: "Centro comunitario norte",
    layer: "Equipamiento",
    status: "En ejecucion",
    neighborhood: "Norte",
    author: "Secretaria de Desarrollo",
    responsible: "Infraestructura Social",
    origin: "Area tecnica",
    promoterArea: "Infraestructura Social",
    description: "Equipamiento publico para actividades barriales, asistencia y gestion territorial.",
    objective: "Concentrar servicios comunitarios y actividades sociales en un nodo de acceso barrial.",
    impact: ["Mejor acceso a servicios", "Fortalecimiento barrial", "Uso intensivo de equipamiento publico"],
    risks: ["Sobrecarga operativa", "Coordinacion interareas", "Costos recurrentes"],
    nextSteps: ["Seguimiento de obra", "Plan operativo", "Agenda comunitaria", "Apertura gradual"],
    votes: 72,
    comments: 12,
    budget: "Alto",
    timeline: "En obra",
    position: [-26.8072, -65.2138],
    codeRelation: "CPU Art. 33 y Art. 36: equipamiento comunitario, accesibilidad y compatibilidad de uso",
    technicalJustification: "El sector norte concentra demanda social y requiere un nodo de servicios con acceso barrial y agenda compartida.",
    attachedDocuments: ["Plan operativo centro norte.docx", "Cronograma obra comunitario.xlsx", "Informe accesibilidad barrial.pdf"],
    reviewStatus: "Elevada a gabinete",
    aiNormativeImpact: "La intervencion no presenta conflicto normativo principal, pero exige plan operativo y medicion de demanda para evitar sobrecarga del equipamiento al momento de apertura."
  },
  {
    id: "codigo-alturas",
    title: "Revision de alturas permitidas",
    layer: "Zonificacion",
    status: "En analisis",
    neighborhood: "Centro / Norte",
    author: "Gabinete urbano",
    responsible: "Planeamiento Urbano",
    origin: "Gabinete",
    promoterArea: "Planeamiento Urbano",
    linkedMeetingId: "gabinete-2026-06-11",
    linkedHearingId: "aud-movilidad-2026",
    description: "Zona de estudio para ordenar densidad, alturas y compatibilidad con servicios.",
    objective: "Actualizar criterios de densidad edilicia segun capacidad vial, servicios y caracter urbano.",
    impact: ["Mayor previsibilidad normativa", "Ordenamiento de inversiones", "Proteccion de areas sensibles"],
    risks: ["Conflictos sectoriales", "Necesidad de estudios tecnicos", "Debate legislativo"],
    nextSteps: ["Relevar normativa", "Mapear servicios", "Mesa tecnica", "Borrador de ordenanza"],
    votes: 54,
    comments: 21,
    budget: "Tecnico",
    timeline: "120 dias de analisis",
    position: [-26.8268, -65.205],
    codeRelation: "CPU Art. 18, Art. 21 y Art. 24: alturas, retiros, capacidad de servicios y estacionamiento",
    technicalJustification: "La presion inmobiliaria sobre Centro / Norte requiere criterios verificables para evitar decisiones parcela por parcela.",
    attachedDocuments: ["Matriz alturas centro norte.xlsx", "Dictamen legal preliminar.docx", "Mapa capacidad servicios.geojson"],
    reviewStatus: "Observada",
    aiNormativeImpact: "La revision necesita expediente robusto, matriz tecnica y audiencia publica. El riesgo principal es aprobar incrementos sin demostrar capacidad vial, sanitaria y de espacio publico."
  },
  {
    id: "drenaje-sali",
    title: "Mitigacion hidrica Rio Sali",
    layer: "Riesgos",
    status: "Planificado",
    neighborhood: "Este",
    author: "Defensa Civil",
    responsible: "Defensa Civil",
    origin: "Area tecnica",
    promoterArea: "Defensa Civil",
    description: "Puntos criticos para obras de drenaje, monitoreo y reduccion de vulnerabilidad.",
    objective: "Reducir vulnerabilidad hidrica en sectores cercanos al borde del Rio Sali.",
    impact: ["Menor riesgo ante lluvias", "Priorizacion de obras", "Mejor respuesta preventiva"],
    risks: ["Dependencia interjurisdiccional", "Costo de obras", "Mantenimiento de canales"],
    nextSteps: ["Mapa de riesgo", "Inspeccion tecnica", "Convenios", "Proyecto ejecutivo"],
    votes: 310,
    comments: 42,
    budget: "Alto",
    timeline: "180 dias de proyecto",
    position: [-26.8466, -65.1902],
    codeRelation: "CPU Art. 45 y Art. 48: areas de riesgo, drenaje urbano y restricciones de ocupacion",
    technicalJustification: "El borde del Rio Sali combina vulnerabilidad hidrica, infraestructura critica y necesidad de coordinacion interjurisdiccional.",
    attachedDocuments: ["Mapa amenaza hidrica Rio Sali.pdf", "Inspeccion canales este.xlsx", "Convenio drenaje provincia borrador.docx"],
    reviewStatus: "En revision normativa",
    aiNormativeImpact: "La propuesta debe tratarse como mitigacion de riesgo antes que como obra aislada. Requiere priorizacion por amenaza, mantenimiento y competencias compartidas con Provincia."
  },
  {
    id: "peatonal-centro",
    title: "Peatonalizacion calle 25 de Mayo",
    layer: "Transporte",
    status: "Realizado",
    neighborhood: "Centro",
    author: "Movilidad Urbana",
    responsible: "Movilidad Urbana",
    origin: "Gabinete",
    promoterArea: "Movilidad Urbana",
    description: "Prueba de pacificacion vial para priorizar caminabilidad y actividad comercial.",
    objective: "Evaluar impacto de una calle con prioridad peatonal en comercio, seguridad y movilidad.",
    impact: ["Mas caminabilidad", "Mayor actividad comercial", "Menor conflicto vehicular"],
    risks: ["Desvio de transito", "Carga y descarga", "Fiscalizacion"],
    nextSteps: ["Medicion post intervencion", "Encuesta comercial", "Ajustes operativos"],
    votes: 164,
    comments: 29,
    budget: "Medio",
    timeline: "Piloto completado",
    position: [-26.8297, -65.2038],
    codeRelation: "CPU Art. 12 y Art. 29: jerarquia vial, espacio publico y prioridad peatonal",
    technicalJustification: "El piloto permitio medir permanencia peatonal, actividad comercial y desvio vehicular antes de definir permanencia.",
    attachedDocuments: ["Informe post piloto 25 de Mayo.pdf", "Encuesta comercial peatonalizacion.xlsx"],
    reviewStatus: "Validada",
    aiNormativeImpact: "La medicion posterior muestra condiciones favorables para consolidar la prioridad peatonal si se formalizan horarios de carga, fiscalizacion y mantenimiento del espacio publico."
  }
];

export function getUrbanProject(id: string) {
  return urbanProjects.find((project) => project.id === id);
}
