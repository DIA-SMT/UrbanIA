import type { HearingMatchStance, HearingSource, HearingStatus } from "@prisma/client";

/**
 * Vocabulario del registro de audiencias y del macheo en vivo audiencia <->
 * mininorma. Solo tipos y constantes: seguro de importar desde el cliente.
 */

export const hearingStatusLabels: Record<HearingStatus, string> = {
  SCHEDULED: "Próxima",
  LIVE: "En vivo",
  PROCESSING: "Procesando",
  COMPLETED: "Finalizada",
  CANCELLED: "Cancelada"
};

export const hearingStatusStyles: Record<HearingStatus, string> = {
  SCHEDULED: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  LIVE: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  PROCESSING: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  COMPLETED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  CANCELLED: "border-slate-300/20 bg-slate-400/[0.06] text-slate-400"
};

export const hearingSourceLabels: Record<HearingSource, string> = {
  LIVE: "Dictado en vivo",
  YOUTUBE: "YouTube",
  UPLOAD: "Transcripción subida",
  MANUAL: "Carga manual"
};

/** Estados visibles en el registro (los de la Etapa 1). */
export const hearingVisibleStatuses: HearingStatus[] = ["SCHEDULED", "LIVE", "PROCESSING", "COMPLETED", "CANCELLED"];

export const stanceLabels: Record<HearingMatchStance, string> = {
  SUPPORT: "A favor",
  OPPOSE: "En contra",
  CHANGE_REQUEST: "Pide cambios",
  MENTION: "Mención"
};

export const stanceStyles: Record<HearingMatchStance, string> = {
  SUPPORT: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  OPPOSE: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  CHANGE_REQUEST: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  MENTION: "border-sky-300/25 bg-sky-300/[0.08] text-sky-200"
};

/** Subconjunto del borrador estructurado que muestra el cierre en vivo. */
export type HearingSummaryView = {
  summary: string;
  keyPoints: string[];
  mainTopic: string;
  conclusions: {
    agreements: string;
    disagreements: string;
    nextSteps: string;
  };
};

/** Un cruce audiencia <-> norma listo para el panel en vivo. */
export type HearingMatchView = {
  id: string;
  normId: string;
  code: string;
  title: string;
  articleNumber: string | null;
  fragment: string;
  stance: HearingMatchStance;
  confidence: number;
  atMs: number | null;
  createdAt: string;
};

/** Codigo nuevo (NormativeReform) elegible como debate de una audiencia. */
export type ReformOption = { id: string; code: string; title: string };

/** Conteos para los stat cards del board. */
export type HearingCounts = { upcoming: number; processing: number; completed: number };

/** Una audiencia en el listado del registro. */
export type HearingListItem = {
  id: string;
  title: string;
  occurredAt: string | null;
  hearingStatus: HearingStatus;
  location: string | null;
  reformId: string | null;
  reformCode: string | null;
  reformTitle: string | null;
  /** Tema libre, cuando la audiencia no está vinculada a un código nuevo. */
  topic: string | null;
  matchCount: number;
  participantCount: number;
};

export type HearingParticipantView = {
  id: string;
  displayName: string;
  role: string | null;
};

/**
 * Ficha estructurada de la audiencia (foto 1): datos, propuesta/normativa y
 * participación que el operador carga a mano. Se guarda en metadata.ficha
 * (sin migración). Los documentos adjuntos (subida de archivos) van aparte.
 */
export type HearingFicha = {
  mainTopic: string;
  secondaryTopics: string;
  relatedProposal: string;
  proposalSource: string;
  author: string;
  relatedArticles: string;
  participants: string;
  institution: string;
  role: string;
  actorType: string;
  intervention: string;
};

export function emptyHearingFicha(): HearingFicha {
  return {
    mainTopic: "",
    secondaryTopics: "",
    relatedProposal: "",
    proposalSource: "",
    author: "",
    relatedArticles: "",
    participants: "",
    institution: "",
    role: "",
    actorType: "",
    intervention: ""
  };
}

/** Normaliza un valor desconocido (metadata JSON) a una ficha completa. */
export function toHearingFicha(value: unknown): HearingFicha {
  const base = emptyHearingFicha();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const record = value as Record<string, unknown>;
  const read = (key: keyof HearingFicha) => (typeof record[key] === "string" ? (record[key] as string) : "");
  return {
    mainTopic: read("mainTopic"),
    secondaryTopics: read("secondaryTopics"),
    relatedProposal: read("relatedProposal"),
    proposalSource: read("proposalSource"),
    author: read("author"),
    relatedArticles: read("relatedArticles"),
    participants: read("participants"),
    institution: read("institution"),
    role: read("role"),
    actorType: read("actorType"),
    intervention: read("intervention")
  };
}

/** Opciones de los selects de la ficha. */
export const proposalSourceOptions = ["Concejo", "Ejecutivo municipal", "Área técnica", "Vecinal / Ciudadana", "Otra"];
export const actorTypeOptions = [
  "Vecino",
  "Concejal",
  "Planeamiento Urbano",
  "Colegio profesional",
  "Universidad",
  "Cámara empresarial",
  "Organización barrial",
  "Especialista técnico",
  "Funcionario municipal"
];

export type HearingTranscriptSegmentView = {
  id: string;
  speakerLabel: string | null;
  startMs: number;
  content: string;
};

export type HearingInsightView = {
  id: string;
  kind: string;
  title: string;
  description: string;
  importance: number;
};

export type HearingMediaView = {
  id: string;
  fileName: string;
  kind: string;
};

/**
 * Documento adjunto de una audiencia. El archivo vive en Supabase Storage; el
 * registro (metadata.documents) guarda el link y los datos para listarlo.
 */
export type HearingDocumentView = {
  id: string;
  fileName: string;
  url: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
};

export type HearingActionItemView = {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: string;
};

/**
 * Ficha 2 (foto 2): conclusiones y temas observados. Migue las precarga al
 * cerrar y el operador las edita. Campos planos para editar directo.
 */
export type HearingConclusions = {
  summary: string;
  agreements: string;
  disagreements: string;
  nextSteps: string;
  technicalRecommendations: string;
  decisions: string;
  proposalStatusAfter: string;
  observedTopics: string;
  importance: string;
  technicalObservation: string;
  citizenObservation: string;
};

export function emptyHearingConclusions(): HearingConclusions {
  return {
    summary: "",
    agreements: "",
    disagreements: "",
    nextSteps: "",
    technicalRecommendations: "",
    decisions: "",
    proposalStatusAfter: "",
    observedTopics: "",
    importance: "Medio",
    technicalObservation: "",
    citizenObservation: ""
  };
}

/** Normaliza un valor desconocido (metadata/JSON) a conclusiones completas. */
export function toHearingConclusions(value: unknown): HearingConclusions {
  const base = emptyHearingConclusions();
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return base;
  const record = entry as Record<string, unknown>;
  const read = (key: keyof HearingConclusions, fallback = "") => (typeof record[key] === "string" ? (record[key] as string) : fallback);
  return {
    summary: read("summary"),
    agreements: read("agreements"),
    disagreements: read("disagreements"),
    nextSteps: read("nextSteps"),
    technicalRecommendations: read("technicalRecommendations"),
    decisions: read("decisions"),
    proposalStatusAfter: read("proposalStatusAfter"),
    observedTopics: read("observedTopics"),
    importance: read("importance", "Medio"),
    technicalObservation: read("technicalObservation"),
    citizenObservation: read("citizenObservation")
  };
}

export const importanceOptions = ["Bajo", "Medio", "Alto", "Crítico"];

/** Analisis IA de la audiencia, ya reducido para lectura. */
export type HearingAnalysisView = {
  summary: string;
  topics: string[];
  conclusions: HearingConclusions | null;
  editedByHuman: boolean;
  createdAt: string;
};

/** Detalle completo de una audiencia para la vista de consulta. */
export type HearingDetail = HearingListItem & {
  description: string | null;
  modality: string | null;
  hearingSource: HearingSource | null;
  createdAt: string;
  /** Borrador de transcripcion en curso (autoguardado del vivo), si lo hay. */
  draftTranscript: string | null;
  /** Ficha estructurada cargada a mano (foto 1). Vive en el HearingRecord. */
  ficha: HearingFicha;
  /**
   * Conclusiones del acta (foto 2). Las firmadas por el equipo viven en el
   * HearingRecord; si no las hay, se muestran las del ultimo analisis IA.
   */
  conclusions: HearingConclusions | null;
  /** True si las conclusiones mostradas fueron revisadas/firmadas por el equipo. */
  conclusionsByTeam: boolean;
  analysis: HearingAnalysisView | null;
  matches: HearingMatchView[];
  participants: HearingParticipantView[];
  insights: HearingInsightView[];
  transcriptSegments: HearingTranscriptSegmentView[];
  mediaFiles: HearingMediaView[];
  /** Documentos adjuntos subidos por el equipo (Supabase Storage). */
  documents: HearingDocumentView[];
  actionItems: HearingActionItemView[];
};
