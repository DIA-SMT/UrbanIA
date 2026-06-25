export type ProjectStatus = "Realizado" | "En ejecucion" | "Planificado" | "En analisis";
export type ProjectLayer = "Transporte" | "Espacios verdes" | "Equipamiento" | "Zonificacion" | "Riesgos";

export type UrbanProject = {
  id: string;
  title: string;
  layer: ProjectLayer;
  status: ProjectStatus;
  neighborhood: string;
  author: string;
  responsible: string;
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
    description: "Corredor de movilidad activa con impacto esperado en seguridad vial y conectividad.",
    objective: "Conectar zonas residenciales, equipamiento publico y corredores comerciales con infraestructura segura para bicicletas.",
    impact: ["Mejora de movilidad activa", "Reduccion de viajes cortos en auto", "Mayor seguridad vial"],
    risks: ["Conflictos con estacionamiento", "Necesidad de mantenimiento", "Aceptacion comercial inicial"],
    nextSteps: ["Relevamiento vial", "Consulta ciudadana", "Anteproyecto tecnico", "Informe de factibilidad"],
    votes: 236,
    comments: 35,
    budget: "Medio",
    timeline: "90 dias de anteproyecto",
    position: [-26.8168, -65.2362]
  },
  {
    id: "plaza-barrio-sur",
    title: "Plaza de bolsillo en Barrio Sur",
    layer: "Espacios verdes",
    status: "Planificado",
    neighborhood: "Barrio Sur",
    author: "Maria B.",
    responsible: "Ambiente y Espacio Publico",
    description: "Intervencion barrial para aumentar cobertura verde y mejorar permanencia peatonal.",
    objective: "Recuperar un lote subutilizado como espacio verde de cercania con sombra, bancos y juegos.",
    impact: ["Aumento de espacios verdes", "Mejora de permanencia barrial", "Mayor actividad comunitaria"],
    risks: ["Disponibilidad dominial", "Costo de mantenimiento", "Seguridad nocturna"],
    nextSteps: ["Validar titularidad", "Reunion barrial", "Diseno preliminar", "Presupuesto"],
    votes: 88,
    comments: 18,
    budget: "Bajo / medio",
    timeline: "60 dias de diseno",
    position: [-26.8354, -65.2172]
  },
  {
    id: "centro-comunitario",
    title: "Centro comunitario norte",
    layer: "Equipamiento",
    status: "En ejecucion",
    neighborhood: "Norte",
    author: "Secretaria de Desarrollo",
    responsible: "Infraestructura Social",
    description: "Equipamiento publico para actividades barriales, asistencia y gestion territorial.",
    objective: "Concentrar servicios comunitarios y actividades sociales en un nodo de acceso barrial.",
    impact: ["Mejor acceso a servicios", "Fortalecimiento barrial", "Uso intensivo de equipamiento publico"],
    risks: ["Sobrecarga operativa", "Coordinacion interareas", "Costos recurrentes"],
    nextSteps: ["Seguimiento de obra", "Plan operativo", "Agenda comunitaria", "Apertura gradual"],
    votes: 72,
    comments: 12,
    budget: "Alto",
    timeline: "En obra",
    position: [-26.8072, -65.2138]
  },
  {
    id: "codigo-alturas",
    title: "Revision de alturas permitidas",
    layer: "Zonificacion",
    status: "En analisis",
    neighborhood: "Centro / Norte",
    author: "Gabinete urbano",
    responsible: "Planeamiento Urbano",
    description: "Zona de estudio para ordenar densidad, alturas y compatibilidad con servicios.",
    objective: "Actualizar criterios de densidad edilicia segun capacidad vial, servicios y caracter urbano.",
    impact: ["Mayor previsibilidad normativa", "Ordenamiento de inversiones", "Proteccion de areas sensibles"],
    risks: ["Conflictos sectoriales", "Necesidad de estudios tecnicos", "Debate legislativo"],
    nextSteps: ["Relevar normativa", "Mapear servicios", "Mesa tecnica", "Borrador de ordenanza"],
    votes: 54,
    comments: 21,
    budget: "Tecnico",
    timeline: "120 dias de analisis",
    position: [-26.8268, -65.205]
  },
  {
    id: "drenaje-sali",
    title: "Mitigacion hidrica Rio Sali",
    layer: "Riesgos",
    status: "Planificado",
    neighborhood: "Este",
    author: "Defensa Civil",
    responsible: "Defensa Civil",
    description: "Puntos criticos para obras de drenaje, monitoreo y reduccion de vulnerabilidad.",
    objective: "Reducir vulnerabilidad hidrica en sectores cercanos al borde del Rio Sali.",
    impact: ["Menor riesgo ante lluvias", "Priorizacion de obras", "Mejor respuesta preventiva"],
    risks: ["Dependencia interjurisdiccional", "Costo de obras", "Mantenimiento de canales"],
    nextSteps: ["Mapa de riesgo", "Inspeccion tecnica", "Convenios", "Proyecto ejecutivo"],
    votes: 310,
    comments: 42,
    budget: "Alto",
    timeline: "180 dias de proyecto",
    position: [-26.8466, -65.1902]
  },
  {
    id: "peatonal-centro",
    title: "Peatonalizacion calle 25 de Mayo",
    layer: "Transporte",
    status: "Realizado",
    neighborhood: "Centro",
    author: "Movilidad Urbana",
    responsible: "Movilidad Urbana",
    description: "Prueba de pacificacion vial para priorizar caminabilidad y actividad comercial.",
    objective: "Evaluar impacto de una calle con prioridad peatonal en comercio, seguridad y movilidad.",
    impact: ["Mas caminabilidad", "Mayor actividad comercial", "Menor conflicto vehicular"],
    risks: ["Desvio de transito", "Carga y descarga", "Fiscalizacion"],
    nextSteps: ["Medicion post intervencion", "Encuesta comercial", "Ajustes operativos"],
    votes: 164,
    comments: 29,
    budget: "Medio",
    timeline: "Piloto completado",
    position: [-26.8297, -65.2038]
  }
];

export function getUrbanProject(id: string) {
  return urbanProjects.find((project) => project.id === id);
}
