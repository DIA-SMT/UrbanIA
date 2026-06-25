import { urbanProjects } from "@/lib/demo/urban-projects";

export type CabinetTopicStatus = "Pendiente" | "En analisis" | "Priorizado" | "Elevado";

export type CabinetMeeting = {
  id: string;
  title: string;
  date: string;
  area: string;
  participants: string[];
  summary: string;
  decisions: string[];
  pending: string[];
  linkedProjectId?: string;
  status: CabinetTopicStatus;
};

export const cabinetMeetings: CabinetMeeting[] = [
  {
    id: "gabinete-2026-06-24",
    title: "Movilidad y corredor Aconquija",
    date: "24 Jun 2026",
    area: "Movilidad Urbana",
    participants: ["Intendencia", "Movilidad", "Planeamiento", "Comunicacion"],
    summary: "Se reviso la posibilidad de avanzar con un corredor de movilidad activa y ordenar estacionamiento en ejes comerciales.",
    decisions: ["Solicitar relevamiento vial", "Preparar alternativa piloto", "Consultar antecedentes comparables"],
    pending: ["Mapa de conflictos de estacionamiento", "Estimacion de costo por tramo"],
    linkedProjectId: "ciclovia-aconquija",
    status: "En analisis"
  },
  {
    id: "gabinete-2026-06-18",
    title: "Espacios verdes de cercania",
    date: "18 Jun 2026",
    area: "Ambiente y Espacio Publico",
    participants: ["Ambiente", "Obras Publicas", "Participacion", "Hacienda"],
    summary: "Se propuso recuperar lotes subutilizados para plazas de bolsillo con prioridad en barrios con baja cobertura verde.",
    decisions: ["Identificar lotes municipales", "Cruzar reclamos ciudadanos", "Diseñar prototipo de plaza"],
    pending: ["Validacion dominial", "Priorizacion por barrio"],
    linkedProjectId: "plaza-barrio-sur",
    status: "Priorizado"
  },
  {
    id: "gabinete-2026-06-11",
    title: "Revision normativa de alturas",
    date: "11 Jun 2026",
    area: "Planeamiento Urbano",
    participants: ["Planeamiento", "Legal", "Catastro", "Concejo"],
    summary: "Se pidio un escenario comparativo para revisar densidad, alturas permitidas y capacidad de servicios en zonas sensibles.",
    decisions: ["Relevar ordenanzas vigentes", "Mapear infraestructura critica", "Preparar matriz de riesgos"],
    pending: ["Informe legal", "Comparacion con ciudades similares"],
    linkedProjectId: "codigo-alturas",
    status: "Elevado"
  }
];

export const cabinetSummary = {
  meetings: cabinetMeetings.length,
  decisions: cabinetMeetings.reduce((total, meeting) => total + meeting.decisions.length, 0),
  pending: cabinetMeetings.reduce((total, meeting) => total + meeting.pending.length, 0),
  linkedProjects: cabinetMeetings.filter((meeting) => meeting.linkedProjectId && urbanProjects.some((project) => project.id === meeting.linkedProjectId)).length
};
