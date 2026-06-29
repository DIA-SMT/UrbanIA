import { urbanProjects } from "@/lib/demo/urban-projects";

export type CabinetTopicStatus = "Pendiente" | "En analisis" | "Priorizado" | "Elevado";

export type CabinetMeeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  expediente: string;
  area: string;
  owner: string;
  participants: string[];
  summary: string;
  conversationSummary: string;
  keyPositions: string[];
  risksDiscussed: string[];
  agenda: string[];
  decisions: string[];
  pending: string[];
  documents: string[];
  minutesStatus: "Borrador" | "Validada" | "Pendiente";
  linkedProjectId?: string;
  linkedScenarioId?: string;
  status: CabinetTopicStatus;
};

export const cabinetMeetings: CabinetMeeting[] = [
  {
    id: "gabinete-2026-06-24",
    title: "Movilidad y corredor Aconquija",
    date: "24 Jun 2026",
    time: "09:30",
    location: "Sala de Gabinete",
    expediente: "EXP-1482-MU-2026",
    area: "Movilidad Urbana",
    owner: "Direccion de Movilidad",
    participants: ["Intendencia", "Movilidad", "Planeamiento", "Comunicacion"],
    summary: "Se reviso la posibilidad de avanzar con un corredor de movilidad activa y ordenar estacionamiento en ejes comerciales.",
    conversationSummary: "Durante la reunion se planteo que el corredor Aconquija puede funcionar como prueba piloto de movilidad activa, pero el equipo marco que el principal punto de friccion sera el estacionamiento sobre ejes comerciales. Movilidad propuso medir flujos y siniestralidad antes de definir tramos; Planeamiento pidio revisar compatibilidad con jerarquia vial y Comunicacion sugirio anticipar una mesa con frentistas para reducir resistencia inicial.",
    keyPositions: ["Movilidad recomienda iniciar con piloto medible", "Planeamiento pide validar criterios viales y normativos", "Comunicacion advierte necesidad de gestion con frentistas"],
    risksDiscussed: ["Conflicto con estacionamiento", "Resistencia comercial inicial", "Falta de datos de flujo por tramo"],
    agenda: ["Estado del corredor Aconquija", "Conflictos de estacionamiento", "Alternativas de piloto", "Comunicacion con frentistas"],
    decisions: ["Solicitar relevamiento vial", "Preparar alternativa piloto", "Consultar antecedentes comparables"],
    pending: ["Mapa de conflictos de estacionamiento", "Estimacion de costo por tramo"],
    documents: ["Relevamiento preliminar.pdf", "Mapa corredor oeste.geojson", "Antecedentes ciclovias.xlsx"],
    minutesStatus: "Borrador",
    linkedProjectId: "ciclovia-aconquija",
    linkedScenarioId: "ciclovia-aconquija",
    status: "En analisis"
  },
  {
    id: "gabinete-2026-06-18",
    title: "Espacios verdes de cercania",
    date: "18 Jun 2026",
    time: "10:00",
    location: "Sala de Situacion",
    expediente: "EXP-0914-AMB-2026",
    area: "Ambiente y Espacio Publico",
    owner: "Subsecretaria de Ambiente",
    participants: ["Ambiente", "Obras Publicas", "Participacion", "Hacienda"],
    summary: "Se propuso recuperar lotes subutilizados para plazas de bolsillo con prioridad en barrios con baja cobertura verde.",
    conversationSummary: "La conversacion se centro en usar plazas de bolsillo como intervencion rapida en barrios con deficit de verde urbano. Ambiente priorizo cobertura y sombra; Obras Publicas pidio validar dominio y factibilidad de mantenimiento; Hacienda solicito estimar costos recurrentes antes de anunciar ubicaciones. Se acordo empezar por un prototipo y cruzarlo con reclamos ciudadanos existentes.",
    keyPositions: ["Ambiente prioriza deficit de cobertura verde", "Obras Publicas condiciona avance a validacion dominial", "Hacienda solicita estimacion de mantenimiento"],
    risksDiscussed: ["Lotes sin titularidad clara", "Costo recurrente de mantenimiento", "Seguridad nocturna del espacio"],
    agenda: ["Lotes municipales disponibles", "Deficit de espacios verdes", "Modelo de plaza de bolsillo", "Mantenimiento posterior"],
    decisions: ["Identificar lotes municipales", "Cruzar reclamos ciudadanos", "Diseñar prototipo de plaza"],
    pending: ["Validacion dominial", "Priorizacion por barrio"],
    documents: ["Inventario lotes municipales.xlsx", "Cobertura verde barrial.pdf"],
    minutesStatus: "Validada",
    linkedProjectId: "plaza-barrio-sur",
    linkedScenarioId: "plaza-barrio-sur",
    status: "Priorizado"
  },
  {
    id: "gabinete-2026-06-11",
    title: "Revision normativa de alturas",
    date: "11 Jun 2026",
    time: "08:45",
    location: "Concejo Deliberante",
    expediente: "EXP-0771-CPU-2026",
    area: "Planeamiento Urbano",
    owner: "Direccion de Planeamiento",
    participants: ["Planeamiento", "Legal", "Catastro", "Concejo"],
    summary: "Se pidio un escenario comparativo para revisar densidad, alturas permitidas y capacidad de servicios en zonas sensibles.",
    conversationSummary: "La reunion tuvo foco normativo. Planeamiento expuso que la revision de alturas necesita cruzar CPU, capacidad de servicios y morfologia urbana antes de llegar a una decision politica. Legal advirtio que cualquier cambio debe sostenerse con expediente robusto y posible audiencia publica. Catastro propuso mapear zonas de presion inmobiliaria para ordenar el debate con evidencia territorial.",
    keyPositions: ["Planeamiento pide matriz tecnica antes de decidir", "Legal recomienda expediente robusto y audiencia", "Catastro propone mapa de presion inmobiliaria"],
    risksDiscussed: ["Conflicto sectorial", "Impugnaciones por falta de fundamento", "Capacidad insuficiente de servicios"],
    agenda: ["Revision de distrito", "Capacidad de servicios", "Riesgos de conflictividad", "Necesidad de audiencia publica"],
    decisions: ["Relevar ordenanzas vigentes", "Mapear infraestructura critica", "Preparar matriz de riesgos"],
    pending: ["Informe legal", "Comparacion con ciudades similares"],
    documents: ["CPU articulos vinculados.pdf", "Mapa alturas centro-norte.geojson", "Dictamen legal preliminar.docx"],
    minutesStatus: "Pendiente",
    linkedProjectId: "codigo-alturas",
    linkedScenarioId: "codigo-alturas",
    status: "Elevado"
  }
];

export const cabinetSummary = {
  meetings: cabinetMeetings.length,
  decisions: cabinetMeetings.reduce((total, meeting) => total + meeting.decisions.length, 0),
  pending: cabinetMeetings.reduce((total, meeting) => total + meeting.pending.length, 0),
  linkedProjects: cabinetMeetings.filter((meeting) => meeting.linkedProjectId && urbanProjects.some((project) => project.id === meeting.linkedProjectId)).length,
  validatedMinutes: cabinetMeetings.filter((meeting) => meeting.minutesStatus === "Validada").length
};
