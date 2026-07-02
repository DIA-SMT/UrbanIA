import { urbanProjects, type ProjectLayer, type UrbanProject } from "@/lib/demo/urban-projects";

export type ScenarioAlternative = {
  title: string;
  description: string;
  impact: string;
  risk: string;
  cost: string;
};

export type ScenarioDecisionCriterion = {
  label: string;
  value: string;
  tone: "sky" | "amber" | "cyan" | "rose";
};

export type UrbanScenario = {
  id: string;
  projectId: string;
  title: string;
  executiveSummary: string;
  hypothesis: string;
  areas: string[];
  evidence: string[];
  missingInformation: string[];
  citizenInputs: string[];
  normativeChecks: string[];
  alternatives: ScenarioAlternative[];
  criteria: ScenarioDecisionCriterion[];
  cabinetChecklist: string[];
  recommendation: string;
};

const layerAreas: Record<ProjectLayer, string[]> = {
  Transporte: ["Movilidad Urbana", "Transito", "Obras Publicas", "Comunicacion"],
  "Espacios verdes": ["Ambiente", "Espacio Publico", "Obras Publicas", "Participacion"],
  Equipamiento: ["Infraestructura Social", "Desarrollo Social", "Hacienda", "Obras Publicas"],
  Zonificacion: ["Planeamiento Urbano", "Legal", "Catastro", "Concejo Deliberante"],
  Riesgos: ["Defensa Civil", "Infraestructura", "Ambiente", "Provincia"]
};

const layerChecks: Record<ProjectLayer, string[]> = {
  Transporte: ["Compatibilidad con jerarquia vial", "Impacto sobre estacionamiento y carga/descarga", "Necesidad de ordenanza o resolucion operativa"],
  "Espacios verdes": ["Dominio del suelo", "Indicadores de cobertura verde", "Mantenimiento y seguridad del espacio publico"],
  Equipamiento: ["Uso permitido del predio", "Capacidad operativa del area responsable", "Costo recurrente posterior a la obra"],
  Zonificacion: ["Distrito del Codigo de Planeamiento Urbano", "Alturas, FOT/FOS y retiros", "Compatibilidad con servicios e infraestructura"],
  Riesgos: ["Mapa de amenaza y vulnerabilidad", "Competencias interjurisdiccionales", "Plan de respuesta y mantenimiento preventivo"]
};

export const urbanScenarios: UrbanScenario[] = urbanProjects.map((project) => buildScenario(project));

export function getUrbanScenario(id: string) {
  return urbanScenarios.find((scenario) => scenario.id === id || scenario.projectId === id);
}

function buildScenario(project: UrbanProject): UrbanScenario {
  const areas = layerAreas[project.layer];
  const normativeChecks = project.codeRelation
    ? [project.codeRelation, ...layerChecks[project.layer]]
    : layerChecks[project.layer];

  return {
    id: project.id,
    projectId: project.id,
    title: `Escenario: ${project.title}`,
    executiveSummary: `Este escenario convierte la propuesta "${project.title}" en una matriz preliminar de decision para gabinete. No predice resultados finales: ordena evidencia, riesgos, areas responsables y alternativas para decidir si conviene avanzar, pedir informacion o reformular.`,
    hypothesis: `Si el municipio avanza con ${project.title.toLowerCase()}, podria mejorar ${project.impact[0]?.toLowerCase() ?? "la gestion urbana"}, siempre que se resuelvan los puntos tecnicos y normativos detectados.`,
    areas,
    evidence: [
      project.description,
      project.objective,
      `Estado actual: ${project.status}`,
      `Area responsable sugerida: ${project.responsible}`
    ],
    missingInformation: [
      "Costo estimado validado por area tecnica",
      "Dictamen normativo formal",
      "Mapa de actores afectados",
      "Criterio de comunicacion publica"
    ],
    citizenInputs: [
      `${project.votes} apoyos registrados como senal preliminar`,
      `${project.comments} comentarios o aportes para clasificar`,
      "Cruce pendiente con sistema ciudadano externo",
      "Identificar barrios o sectores con mayor sensibilidad"
    ],
    normativeChecks,
    alternatives: buildAlternatives(project),
    criteria: [
      { label: "Viabilidad tecnica", value: project.status === "Realizado" ? "Alta" : "Media", tone: "sky" },
      { label: "Riesgo normativo", value: project.layer === "Zonificacion" ? "Alto" : "Medio", tone: project.layer === "Zonificacion" ? "rose" : "amber" },
      { label: "Consenso inicial", value: project.votes > 150 ? "Favorable" : "A construir", tone: project.votes > 150 ? "sky" : "cyan" },
      { label: "Datos faltantes", value: "4 puntos", tone: "amber" }
    ],
    cabinetChecklist: [
      "Definir si se solicita dictamen tecnico formal",
      "Validar area responsable y responsables secundarios",
      "Resolver si requiere audiencia publica o instancia ciudadana",
      "Decidir si avanza como piloto, anteproyecto o archivo temporal",
      "Encargar informe final para proxima reunion de gabinete"
    ],
    recommendation: buildRecommendation(project)
  };
}

function buildAlternatives(project: UrbanProject): ScenarioAlternative[] {
  return [
    {
      title: "Piloto controlado",
      description: "Implementar una version acotada, con plazo definido y medicion antes/despues.",
      impact: "Permite validar la idea con menor exposicion politica y tecnica.",
      risk: "Puede quedar corto si el problema requiere una intervencion estructural.",
      cost: "Bajo / medio"
    },
    {
      title: "Proyecto integral",
      description: "Avanzar con diseno completo, expediente tecnico, normativa y presupuesto formal.",
      impact: `Mayor capacidad de resolver ${project.layer.toLowerCase()} de forma sostenida.`,
      risk: "Mayor tiempo de preparacion y necesidad de consenso interarea.",
      cost: project.budget
    },
    {
      title: "Reformular y ampliar evidencia",
      description: "Postergar decision ejecutiva y pedir informacion complementaria antes de avanzar.",
      impact: "Reduce riesgo de decision incompleta y mejora trazabilidad institucional.",
      risk: "Puede ser percibido como demora si hay demanda ciudadana alta.",
      cost: "Tecnico"
    }
  ];
}

function buildRecommendation(project: UrbanProject) {
  if (project.status === "Realizado") {
    return "Usar este caso como antecedente: medir resultados, documentar aprendizajes y convertirlo en referencia para nuevas propuestas.";
  }

  if (project.layer === "Zonificacion") {
    return "No avanzar a decision ejecutiva sin dictamen normativo. Conviene preparar matriz legal, audiencia o instancia deliberativa y comparacion con casos similares.";
  }

  if (project.votes > 200) {
    return "Avanzar como piloto controlado con comunicacion temprana, indicadores claros y revision tecnica antes de comprometer obra definitiva.";
  }

  return "Mantener en evaluacion, completar informacion faltante y volver a gabinete con alternativas priorizadas.";
}
