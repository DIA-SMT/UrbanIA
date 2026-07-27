import "server-only";

import {
  Prisma,
  type MunicipalArea,
  type ProjectStage,
  type ProjectStatus,
  type ProposalSource,
  type ReformStatus
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  NormDetail,
  NormListItem,
  ProjectAnchorView,
  ProjectAttachmentView,
  ProjectBudgetItemView,
  ProjectCitedArticle,
  ProjectDetail,
  ProjectDiagnosisView,
  ProjectListItem,
  ReformDetail,
  ReformListItem
} from "@/lib/projects/shared";

/**
 * Acceso server-side al modulo de proyectos. Lo comparten las API routes y las
 * paginas server component. Espeja el estilo de lib/proposals/data.ts.
 */

const listInclude = {
  budgetItems: { select: { amount: true } },
  diagnoses: { orderBy: { version: "desc" }, take: 1, select: { feasibility: true } },
  createdBy: { select: { id: true, name: true } },
  supports: { select: { voterName: true, value: true } },
  _count: { select: { opinions: true } }
} satisfies Prisma.ProjectInclude;

const detailInclude = {
  budgetItems: { orderBy: { createdAt: "asc" } },
  attachments: { orderBy: { createdAt: "asc" } },
  diagnoses: { orderBy: { version: "desc" } },
  proposal: { select: { id: true, title: true } },
  reform: { select: { id: true, code: true, title: true } },
  createdBy: { select: { id: true, name: true } },
  supports: { select: { voterName: true, value: true } },
  _count: { select: { opinions: true } }
} satisfies Prisma.ProjectInclude;

type ProjectListPayload = Prisma.ProjectGetPayload<{ include: typeof listInclude }>;
type ProjectDetailPayload = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

function toNumber(value: Prisma.Decimal | number | null): number {
  if (value === null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function asStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asCitedArticles(value: Prisma.JsonValue | null): ProjectCitedArticle[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { [key: string]: Prisma.JsonValue } => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      articleId: String(item.articleId ?? ""),
      articleNumber: String(item.articleNumber ?? ""),
      quote: String(item.quote ?? "")
    }))
    .filter((item) => item.articleId && item.quote);
}

/**
 * Apoyo del equipo sobre una norma.
 *
 * El voto propio NO se resuelve aca: se cuenta por nombre declarado, y quien esta
 * trabajando vive en el sessionStorage del navegador, que el servidor no ve. Por
 * eso se devuelve la lista de votantes y el cliente marca el boton activo.
 */
function toSupportSummary(supports: { voterName: string; value: number }[]) {
  let supportCount = 0;
  let objectionCount = 0;

  for (const support of supports) {
    if (support.value > 0) supportCount += 1;
    else if (support.value < 0) objectionCount += 1;
  }

  return {
    supportCount,
    objectionCount,
    supportNet: supportCount - objectionCount,
    voters: supports.map((support) => ({ voterName: support.voterName, value: support.value }))
  };
}

export function toProjectListItem(project: ProjectListPayload, anchorCount: number): ProjectListItem {
  return {
    ...toSupportSummary(project.supports),
    opinionCount: project._count.opinions,
    authorId: project.createdBy?.id ?? null,
    // Los dos por separado: el DTO lleva los hechos y la UI decide como mostrarlos.
    // Resolver el fallback aca haria que el formulario prellenara el campo con el
    // nombre de la cuenta compartida, que es justo lo que hay que evitar.
    authorName: project.authorName,
    authorAccount: project.createdBy?.name ?? null,
    id: project.id,
    code: project.code,
    title: project.title,
    summary: project.summary,
    status: project.status,
    stage: project.stage,
    source: project.source,
    areas: project.areas,
    requiresEIA: project.requiresEIA,
    addressLabel: project.addressLabel,
    latitude: project.latitude,
    longitude: project.longitude,
    reformId: project.reformId,
    articleNumber: project.articleNumber,
    hasArticleText: Boolean(project.articleText && project.articleText.trim().length),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    budgetTotal: project.budgetItems.reduce((sum, item) => sum + toNumber(item.amount), 0),
    anchorCount,
    latestFeasibility: project.diagnoses[0]?.feasibility ?? null
  };
}

function toDiagnosisView(diagnosis: ProjectDetailPayload["diagnoses"][number]): ProjectDiagnosisView {
  return {
    id: diagnosis.id,
    version: diagnosis.version,
    feasibility: diagnosis.feasibility,
    scope: diagnosis.scope,
    objective: diagnosis.objective,
    analysis: diagnosis.analysis,
    actions: asStringArray(diagnosis.actions),
    risks: asStringArray(diagnosis.risks),
    citedArticles: asCitedArticles(diagnosis.citedArticles),
    proposedText: diagnosis.proposedText,
    model: diagnosis.model,
    editedByHuman: diagnosis.editedByHuman,
    createdAt: diagnosis.createdAt.toISOString()
  };
}

function toBudgetItemView(item: ProjectDetailPayload["budgetItems"][number]): ProjectBudgetItemView {
  return {
    id: item.id,
    concept: item.concept,
    costType: item.costType,
    baseAmount: toNumber(item.baseAmount),
    multiplier: item.multiplier,
    fundingSource: item.fundingSource,
    amount: toNumber(item.amount),
    createdAt: item.createdAt.toISOString()
  };
}

function toAttachmentView(attachment: ProjectDetailPayload["attachments"][number]): ProjectAttachmentView {
  return {
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    excerpt: attachment.excerpt,
    meetingId: attachment.meetingId,
    createdAt: attachment.createdAt.toISOString()
  };
}

/** Trae los NormativeLink de un proyecto con el articulo incluido. */
export async function getProjectAnchors(projectId: string): Promise<ProjectAnchorView[]> {
  const links = await prisma.normativeLink.findMany({
    where: { sourceType: "project", sourceId: projectId },
    include: { article: { select: { articleNumber: true, title: true } } },
    orderBy: { createdAt: "asc" }
  });

  return links.map((link) => ({
    id: link.id,
    articleId: link.articleId,
    articleNumber: link.article.articleNumber,
    articleTitle: link.article.title ?? `Articulo ${link.article.articleNumber}`,
    relationshipType: link.relationshipType,
    notes: link.notes,
    createdBy: link.createdBy
  }));
}

/**
 * Nombres que ya firmaron una norma o una devolucion.
 *
 * Alimentan el desplegable de autoria. No se recuerda "el ultimo que escribio":
 * la cuenta es compartida y prellenar el campo con el nombre anterior hace que la
 * proxima persona publique firmando como otra sin darse cuenta. La lista se ofrece,
 * pero elegirse es un acto explicito.
 */
export async function listAuthorNames(): Promise<string[]> {
  const [fromNorms, fromOpinions] = await Promise.all([
    prisma.project.findMany({
      where: { authorName: { not: null } },
      select: { authorName: true },
      distinct: ["authorName"]
    }),
    prisma.normOpinion.findMany({ select: { authorName: true }, distinct: ["authorName"] })
  ]);

  const names = new Set<string>();
  for (const row of fromNorms) if (row.authorName) names.add(row.authorName);
  for (const row of fromOpinions) names.add(row.authorName);

  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

export type ProjectFilters = { status?: ProjectStatus; stage?: ProjectStage; area?: MunicipalArea; reformId?: string };

export async function listProjects(filters: ProjectFilters = {}): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.area ? { areas: { has: filters.area } } : {}),
      ...(filters.reformId ? { reformId: filters.reformId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: listInclude
  });

  if (!projects.length) return [];

  const anchorCounts = await prisma.normativeLink.groupBy({
    by: ["sourceId"],
    where: { sourceType: "project", sourceId: { in: projects.map((project) => project.id) } },
    _count: { _all: true }
  });
  const anchorMap = new Map(anchorCounts.map((entry) => [entry.sourceId, entry._count._all]));

  return projects.map((project) => toProjectListItem(project, anchorMap.get(project.id) ?? 0));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const project = await prisma.project.findUnique({ where: { id }, include: detailInclude });
  if (!project) return null;

  const anchors = await getProjectAnchors(project.id);

  return {
    ...toProjectListItem(
      { ...project, diagnoses: project.diagnoses.slice(0, 1).map((diagnosis) => ({ feasibility: diagnosis.feasibility })) },
      anchors.length,
    ),
    eiaNotes: project.eiaNotes,
    officialNotes: project.officialNotes,
    districtId: project.districtId,
    proposalId: project.proposalId,
    proposalTitle: project.proposal?.title ?? null,
    articleText: project.articleText,
    reformCode: project.reform?.code ?? null,
    reformTitle: project.reform?.title ?? null,
    diagnoses: project.diagnoses.map(toDiagnosisView),
    budgetItems: project.budgetItems.map(toBudgetItemView),
    attachments: project.attachments.map(toAttachmentView),
    anchors
  };
}

export type CreateProjectInput = {
  title: string;
  summary: string;
  status?: ProjectStatus;
  stage?: ProjectStage;
  source: ProposalSource;
  areas?: MunicipalArea[];
  requiresEIA?: boolean;
  eiaNotes?: string | null;
  proposalId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressLabel?: string | null;
  districtId?: string | null;
  officialNotes?: string | null;
  createdById?: string | null;
  /** Persona que redacta, dentro de la cuenta compartida. */
  authorName?: string | null;
  reformId?: string | null;
  articleNumber?: string | null;
  articleText?: string | null;
};

async function nextProjectCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRY-${year}-`;
  const last = await tx.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const lastSeq = last ? Number(last.code.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  // El correlativo se genera en transaccion; ante colision del unique en `code`
  // (dos altas concurrentes) reintentamos con el siguiente numero.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const code = await nextProjectCode(tx);
        return tx.project.create({
          data: {
            code,
            title: input.title,
            summary: input.summary,
            status: input.status ?? "DRAFT",
            stage: input.stage ?? "FORMULATION",
            source: input.source,
            areas: input.areas ?? [],
            requiresEIA: input.requiresEIA ?? false,
            eiaNotes: input.eiaNotes ?? null,
            proposalId: input.proposalId ?? null,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            addressLabel: input.addressLabel ?? null,
            districtId: input.districtId ?? null,
            officialNotes: input.officialNotes ?? null,
            createdById: input.createdById ?? null,
            authorName: input.authorName ?? null,
            reformId: input.reformId ?? null,
            articleNumber: input.articleNumber ?? null,
            articleText: input.articleText ?? null
          },
          select: { id: true }
        });
      });

      const detail = await getProject(created.id);
      if (!detail) throw new Error("No se pudo leer el proyecto recien creado");
      return detail;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("No se pudo generar un codigo de proyecto unico");
}

export type UpdateProjectInput = Partial<
  Omit<CreateProjectInput, "createdById" | "source"> & { source: ProposalSource; stage: ProjectStage; status: ProjectStatus }
>;

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDetail | null> {
  await prisma.project.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.areas !== undefined ? { areas: input.areas } : {}),
      ...(input.requiresEIA !== undefined ? { requiresEIA: input.requiresEIA } : {}),
      ...(input.eiaNotes !== undefined ? { eiaNotes: input.eiaNotes } : {}),
      ...(input.proposalId !== undefined ? { proposalId: input.proposalId } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.addressLabel !== undefined ? { addressLabel: input.addressLabel } : {}),
      ...(input.districtId !== undefined ? { districtId: input.districtId } : {}),
      ...(input.officialNotes !== undefined ? { officialNotes: input.officialNotes } : {}),
      ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
      ...(input.reformId !== undefined ? { reformId: input.reformId } : {}),
      ...(input.articleNumber !== undefined ? { articleNumber: input.articleNumber } : {}),
      ...(input.articleText !== undefined ? { articleText: input.articleText } : {})
    }
  });

  return getProject(id);
}

/* ------------------------------------------------------------------------- */
/* Fabrica de Normas: una norma es un Project con reformId; el contenedor es  */
/* NormativeReform. Reutiliza toda la maquinaria de proyectos.                */
/* ------------------------------------------------------------------------- */

export type NormFilters = { status?: ProjectStatus; area?: MunicipalArea };

/** Normas de un codigo nuevo, con filtros por estado y materia. */
export async function listNorms(reformId: string, filters: NormFilters = {}): Promise<NormListItem[]> {
  return listProjects({ ...filters, reformId });
}

/**
 * Detalle de una norma: anchors, ultimo analisis y articleText incluidos.
 */
export async function getNorm(id: string): Promise<NormDetail | null> {
  return getProject(id);
}

/** NormativeLink de una norma con el articulo del CPU 2014 incluido. */
export async function getNormAnchors(normId: string): Promise<ProjectAnchorView[]> {
  return getProjectAnchors(normId);
}

export type CreateNormInput = {
  reformId: string;
  title: string;
  summary: string;
  status?: ProjectStatus;
  areas?: MunicipalArea[];
  articleNumber?: string | null;
  articleText?: string | null;
  officialNotes?: string | null;
  createdById?: string | null;
  /** Persona que redacta, dentro de la cuenta compartida. */
  authorName?: string | null;
};

async function nextNormCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NOR-${year}-`;
  const last = await tx.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const lastSeq = last ? Number(last.code.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Crea una norma dentro de un codigo nuevo. Mismo patron transaccional que createProject. */
export async function createNorm(input: CreateNormInput): Promise<NormDetail> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const code = await nextNormCode(tx);
        return tx.project.create({
          data: {
            code,
            title: input.title,
            summary: input.summary,
            status: input.status ?? "DRAFT",
            source: "TECHNICAL_TEAM",
            areas: input.areas ?? [],
            reformId: input.reformId,
            articleNumber: input.articleNumber ?? null,
            articleText: input.articleText ?? null,
            officialNotes: input.officialNotes ?? null,
            createdById: input.createdById ?? null,
            authorName: input.authorName ?? null
          },
          select: { id: true }
        });
      });

      const detail = await getNorm(created.id);
      if (!detail) throw new Error("No se pudo leer la norma recien creada");
      return detail;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("No se pudo generar un codigo de norma unico");
}

export type UpdateNormInput = Partial<Omit<CreateNormInput, "createdById" | "reformId"> & { reformId: string | null }>;

export async function updateNorm(id: string, input: UpdateNormInput): Promise<NormDetail | null> {
  return updateProject(id, input);
}

/* --------------------------- Codigos nuevos ------------------------------- */

export type ReformFilters = { status?: ReformStatus };

const CONFLICT_LEVELS = ["LOW", "BLOCKED"] as const;

/** Ultimo diagnostico por norma, reducido en memoria (los volumenes son chicos). */
async function latestFeasibilityByNorm(normIds: string[]): Promise<Map<string, string>> {
  if (!normIds.length) return new Map();
  const diagnoses = await prisma.projectDiagnosis.findMany({
    where: { projectId: { in: normIds } },
    orderBy: [{ projectId: "asc" }, { version: "desc" }],
    select: { projectId: true, feasibility: true }
  });
  const latest = new Map<string, string>();
  for (const diagnosis of diagnoses) {
    if (!latest.has(diagnosis.projectId)) latest.set(diagnosis.projectId, diagnosis.feasibility);
  }
  return latest;
}

const reformInclude = {
  norms: { select: { id: true, status: true } },
  createdBy: { select: { id: true, name: true } }
} satisfies Prisma.NormativeReformInclude;

type ReformPayload = Prisma.NormativeReformGetPayload<{ include: typeof reformInclude }>;

/**
 * `latest` viene precargado por el llamador: resolverlo aca adentro hacia una
 * consulta de diagnosticos POR REFORMA (N+1). Ahora se pide una sola vez para
 * todas las normas de todas las reformas del listado.
 */
function toReformListItem(reform: ReformPayload, latest: Map<string, string>): ReformListItem {
  const conflictCount = reform.norms.filter((norm) =>
    (CONFLICT_LEVELS as readonly string[]).includes(latest.get(norm.id) ?? "")
  ).length;

  return {
    id: reform.id,
    code: reform.code,
    title: reform.title,
    description: reform.description,
    status: reform.status,
    createdAt: reform.createdAt.toISOString(),
    normCount: reform.norms.length,
    draftCount: reform.norms.filter((norm) => norm.status === "DRAFT").length,
    inReviewCount: reform.norms.filter((norm) => norm.status === "IN_REVIEW").length,
    consolidatedCount: reform.norms.filter((norm) => norm.status === "APPROVED").length,
    conflictCount,
    authorId: reform.createdBy?.id ?? null,
    // Los codigos todavia no piden quien redacta a mano: solo tienen la cuenta.
    authorName: null,
    authorAccount: reform.createdBy?.name ?? null
  };
}

export async function listReforms(filters: ReformFilters = {}): Promise<ReformListItem[]> {
  const reforms = await prisma.normativeReform.findMany({
    where: filters.status ? { status: filters.status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: reformInclude
  });

  // Un unico barrido de diagnosticos para TODAS las normas del listado.
  const latest = await latestFeasibilityByNorm(reforms.flatMap((reform) => reform.norms.map((norm) => norm.id)));
  return reforms.map((reform) => toReformListItem(reform, latest));
}

/**
 * Solo id, code y title de cada codigo nuevo, para poblar selects. listReforms
 * trae ademas las normas, el autor y el diagnostico de cada una: pedirlo entero
 * para armar un desplegable de tres campos es carisimo.
 */
export async function listReformOptions(): Promise<Array<{ id: string; code: string; title: string }>> {
  return prisma.normativeReform.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, code: true, title: true }
  });
}

/** Detalle de un codigo nuevo con sus normas. */
export async function getReform(id: string): Promise<ReformDetail | null> {
  const reform = await prisma.normativeReform.findUnique({
    where: { id },
    include: reformInclude
  });
  if (!reform) return null;

  const [latest, norms] = await Promise.all([
    latestFeasibilityByNorm(reform.norms.map((norm) => norm.id)),
    listNorms(reform.id, {})
  ]);

  return { ...toReformListItem(reform, latest), updatedAt: reform.updatedAt.toISOString(), norms };
}

export type CreateReformInput = { title: string; description?: string | null; createdById?: string | null };

async function nextReformCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COD-${year}-`;
  const last = await tx.normativeReform.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const lastSeq = last ? Number(last.code.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

export async function createReform(input: CreateReformInput): Promise<ReformDetail> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const code = await nextReformCode(tx);
        return tx.normativeReform.create({
          data: {
            code,
            title: input.title,
            description: input.description ?? null,
            createdById: input.createdById ?? null
          },
          select: { id: true }
        });
      });

      const detail = await getReform(created.id);
      if (!detail) throw new Error("No se pudo leer el codigo nuevo recien creado");
      return detail;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("No se pudo generar un codigo unico para la reforma");
}

export type UpdateReformInput = { title?: string; description?: string | null; status?: ReformStatus };

export async function updateReform(id: string, input: UpdateReformInput): Promise<ReformDetail | null> {
  await prisma.normativeReform.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    }
  });
  return getReform(id);
}

export async function archiveReform(id: string): Promise<ReformDetail | null> {
  return updateReform(id, { status: "ARCHIVED" });
}
