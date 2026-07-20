import type {
  BudgetCostType,
  FeasibilityLevel,
  MunicipalArea,
  NormativeRelationshipType,
  ProjectStage,
  ProjectStatus,
  ProposalSource,
  ReformStatus
} from "@prisma/client";

/**
 * Vocabulario y estilos compartidos del modulo de proyectos. Espeja el estilo de
 * lib/proposals/shared.ts. Solo tipos + constantes: seguro de importar en cliente.
 */

export const projectStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revision",
  APPROVED: "Aprobado",
  IN_PROGRESS: "En ejecucion",
  SUSPENDED: "Suspendido",
  COMPLETED: "Finalizado",
  ARCHIVED: "Archivado"
};

export const projectStatusStyles: Record<ProjectStatus, string> = {
  DRAFT: "border-slate-300/30 bg-slate-400/10 text-slate-200",
  IN_REVIEW: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  APPROVED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  IN_PROGRESS: "border-[#1f89f6]/40 bg-[#1f89f6]/15 text-sky-100",
  SUSPENDED: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  ARCHIVED: "border-slate-300/20 bg-slate-400/[0.06] text-slate-400"
};

export const projectStageLabels: Record<ProjectStage, string> = {
  FORMULATION: "Formulacion",
  TECHNICAL_REVIEW: "Revision tecnica",
  CABINET_REVIEW: "Revision de gabinete",
  TENDER: "Licitacion",
  EXECUTION: "Ejecucion",
  CLOSED: "Cerrado"
};

export const municipalAreaLabels: Record<MunicipalArea, string> = {
  PLANEAMIENTO: "Planeamiento",
  OBRAS_PUBLICAS: "Obras publicas",
  AMBIENTE: "Ambiente",
  MOVILIDAD: "Movilidad",
  ESPACIO_PUBLICO: "Espacio publico",
  DESARROLLO_SOCIAL: "Desarrollo social",
  HACIENDA: "Hacienda",
  LEGAL: "Legal",
  OTRA: "Otra"
};

export const proposalSourceLabels: Record<ProposalSource, string> = {
  CITIZEN: "Ciudadana",
  OFFICIAL: "Oficial",
  CABINET: "Gabinete",
  TECHNICAL_TEAM: "Area tecnica"
};

export const relationshipTypeLabels: Record<NormativeRelationshipType, string> = {
  APPLIES: "Aplica",
  MODIFIES: "Modifica",
  REPEALS: "Deroga",
  REPLACES: "Reemplaza",
  REFERENCES: "Refiere",
  POTENTIAL_CONFLICT: "Posible conflicto",
  SUPPORTS: "Respalda",
  REQUIRES_REVIEW: "Requiere revision"
};

export const relationshipTypeStyles: Record<NormativeRelationshipType, string> = {
  APPLIES: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  MODIFIES: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  REPEALS: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  REPLACES: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  REFERENCES: "border-slate-300/25 bg-slate-400/10 text-slate-200",
  POTENTIAL_CONFLICT: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  SUPPORTS: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  REQUIRES_REVIEW: "border-amber-300/30 bg-amber-300/10 text-amber-100"
};

export const feasibilityLabels: Record<FeasibilityLevel, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  BLOCKED: "Bloqueada"
};

export const feasibilityStyles: Record<FeasibilityLevel, string> = {
  HIGH: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  MEDIUM: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  LOW: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  BLOCKED: "border-rose-300/30 bg-rose-300/10 text-rose-100"
};

export const budgetCostTypeLabels: Record<BudgetCostType, string> = {
  OBRA: "Obra",
  ESTUDIO_PROYECTO: "Estudio / proyecto",
  EQUIPAMIENTO: "Equipamiento",
  MANTENIMIENTO: "Mantenimiento",
  EXPROPIACION: "Expropiacion",
  OTRO: "Otro"
};

/**
 * Montos base de referencia por tipo de costo (en pesos). Punto unico de edicion.
 * El presupuesto de cada item es baseAmount * multiplier (0.5x a 5x).
 */
export const budgetBaseAmounts: Record<BudgetCostType, number> = {
  OBRA: 45_000_000,
  ESTUDIO_PROYECTO: 12_000_000,
  EQUIPAMIENTO: 8_000_000,
  MANTENIMIENTO: 6_000_000,
  EXPROPIACION: 30_000_000,
  OTRO: 5_000_000
};

export const budgetMultipliers = [0.5, 1, 1.5, 2, 3, 4, 5];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

/**
 * Vocabulario de la Fabrica de Normas. El modelo Project se reinterpreta como
 * NORMA (articulo de un codigo nuevo) y ProjectDiagnosis como analisis de
 * impacto normativo. Mismos enums, otra semantica.
 */

/** Estados de Project visibles en la Fabrica. Los de obra siguen validos pero no se muestran. */
export const normVisibleStatuses: ProjectStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"];

export const normStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Consolidada",
  IN_PROGRESS: "En ejecución",
  SUSPENDED: "Suspendida",
  COMPLETED: "Finalizada",
  ARCHIVED: "Archivada"
};

export const normStatusStyles: Record<ProjectStatus, string> = {
  DRAFT: "border-slate-300/30 bg-slate-400/10 text-slate-200",
  IN_REVIEW: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  APPROVED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  IN_PROGRESS: "border-[#1f89f6]/40 bg-[#1f89f6]/15 text-sky-100",
  SUSPENDED: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  ARCHIVED: "border-slate-300/20 bg-slate-400/[0.06] text-slate-400"
};

export const reformStatusLabels: Record<ReformStatus, string> = {
  DRAFT: "En armado",
  IN_REVIEW: "En revisión",
  CONSOLIDATED: "Consolidado",
  ARCHIVED: "Archivado"
};

export const reformStatusStyles: Record<ReformStatus, string> = {
  DRAFT: "border-slate-300/30 bg-slate-400/10 text-slate-200",
  IN_REVIEW: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  CONSOLIDATED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  ARCHIVED: "border-slate-300/20 bg-slate-400/[0.06] text-slate-400"
};

/** Las areas municipales presentadas como "materia" de la norma. */
export const materiaLabels = municipalAreaLabels;

/**
 * FeasibilityLevel reinterpretado como nivel de conflicto normativo con el
 * codigo vigente. HIGH = sin conflictos, BLOCKED = choca de fondo.
 */
export const conflictLevelLabels: Record<FeasibilityLevel, string> = {
  HIGH: "Sin conflictos",
  MEDIUM: "Ajustes menores",
  LOW: "Conflictos relevantes",
  BLOCKED: "Choca con el código vigente"
};

export const conflictLevelStyles: Record<FeasibilityLevel, string> = {
  HIGH: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  MEDIUM: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  LOW: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  BLOCKED: "border-rose-300/30 bg-rose-300/10 text-rose-100"
};

/** Relaciones que ofrece el editor de norma al anclar un articulo del CPU 2014. */
export const normAnchorRelationships: NormativeRelationshipType[] = [
  "MODIFIES",
  "REPEALS",
  "REPLACES",
  "REFERENCES",
  "POTENTIAL_CONFLICT"
];

export type ProjectCitedArticle = { articleId: string; articleNumber: string; quote: string };

export type ProjectDiagnosisView = {
  id: string;
  version: number;
  feasibility: FeasibilityLevel;
  scope: string;
  objective: string;
  analysis: string;
  actions: string[];
  risks: string[];
  citedArticles: ProjectCitedArticle[];
  /** Redaccion de articulo sugerida por la IA. Editable, nunca la palabra final. */
  proposedText: string | null;
  model: string | null;
  editedByHuman: boolean;
  createdAt: string;
};

export type ProjectBudgetItemView = {
  id: string;
  concept: string;
  costType: BudgetCostType;
  baseAmount: number;
  multiplier: number;
  fundingSource: string | null;
  amount: number;
  createdAt: string;
};

export type ProjectAttachmentView = {
  id: string;
  kind: string;
  name: string;
  excerpt: string | null;
  meetingId: string | null;
  createdAt: string;
};

export type ProjectAnchorView = {
  id: string;
  articleId: string;
  articleNumber: string;
  articleTitle: string;
  relationshipType: NormativeRelationshipType;
  notes: string | null;
  /** Origen del anclaje: "ia" (detectado en la comparacion) o "manual"/"seed" (humano). */
  createdBy: string | null;
};

export type ProjectListItem = {
  id: string;
  code: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  stage: ProjectStage;
  source: ProposalSource;
  areas: MunicipalArea[];
  requiresEIA: boolean;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  reformId: string | null;
  articleNumber: string | null;
  hasArticleText: boolean;
  createdAt: string;
  budgetTotal: number;
  anchorCount: number;
  latestFeasibility: FeasibilityLevel | null;
  /** Quien la creo. Null en los registros anteriores a que se guardara el autor. */
  authorId: string | null;
  authorName: string | null;
  /** Devoluciones internas del equipo sobre la norma. */
  opinionCount: number;
  /** Apoyo interno: a favor, en contra y el neto. */
  supportCount: number;
  objectionCount: number;
  supportNet: number;
  /** Voto del usuario que mira, si lo resolvio la consulta. */
  myValue: 1 | -1 | null;
};

export type ProjectDetail = ProjectListItem & {
  eiaNotes: string | null;
  officialNotes: string | null;
  districtId: string | null;
  proposalId: string | null;
  proposalTitle: string | null;
  articleText: string | null;
  reformCode: string | null;
  reformTitle: string | null;
  updatedAt: string;
  diagnoses: ProjectDiagnosisView[];
  budgetItems: ProjectBudgetItemView[];
  attachments: ProjectAttachmentView[];
  anchors: ProjectAnchorView[];
};

/** En la Fabrica de Normas, una norma ES un Project reinterpretado. */
export type NormListItem = ProjectListItem;
export type NormDetail = ProjectDetail;

export type ReformListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: ReformStatus;
  createdAt: string;
  normCount: number;
  draftCount: number;
  inReviewCount: number;
  consolidatedCount: number;
  /** Normas cuyo ultimo analisis detecto conflictos relevantes o de fondo. */
  conflictCount: number;
  /** Quien creo el codigo. Null en los registros anteriores al autor. */
  authorId: string | null;
  authorName: string | null;
};

export type ReformDetail = ReformListItem & {
  updatedAt: string;
  norms: NormListItem[];
};
