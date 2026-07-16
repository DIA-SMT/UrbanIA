import "server-only";

import { Prisma, type MunicipalArea, type ProjectStage, type ProjectStatus, type ProposalSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  ProjectAnchorView,
  ProjectAttachmentView,
  ProjectBudgetItemView,
  ProjectCitedArticle,
  ProjectDetail,
  ProjectDiagnosisView,
  ProjectListItem
} from "@/lib/projects/shared";

/**
 * Acceso server-side al modulo de proyectos. Lo comparten las API routes y las
 * paginas server component. Espeja el estilo de lib/proposals/data.ts.
 */

const listInclude = {
  budgetItems: { select: { amount: true } },
  diagnoses: { orderBy: { version: "desc" }, take: 1, select: { feasibility: true } }
} satisfies Prisma.ProjectInclude;

const detailInclude = {
  budgetItems: { orderBy: { createdAt: "asc" } },
  attachments: { orderBy: { createdAt: "asc" } },
  diagnoses: { orderBy: { version: "desc" } },
  proposal: { select: { id: true, title: true } }
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

export function toProjectListItem(project: ProjectListPayload, anchorCount: number): ProjectListItem {
  return {
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
    createdAt: project.createdAt.toISOString(),
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
    notes: link.notes
  }));
}

export type ProjectFilters = { status?: ProjectStatus; stage?: ProjectStage; area?: MunicipalArea };

export async function listProjects(filters: ProjectFilters = {}): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.area ? { areas: { has: filters.area } } : {})
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
      anchors.length
    ),
    eiaNotes: project.eiaNotes,
    officialNotes: project.officialNotes,
    districtId: project.districtId,
    proposalId: project.proposalId,
    proposalTitle: project.proposal?.title ?? null,
    updatedAt: project.updatedAt.toISOString(),
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
            createdById: input.createdById ?? null
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
      ...(input.officialNotes !== undefined ? { officialNotes: input.officialNotes } : {})
    }
  });

  return getProject(id);
}
