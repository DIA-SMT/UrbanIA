import "server-only";

import type { DebateStance, DebateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fullName } from "@/lib/settings/shared";

/** Lecturas del foro de debates. Las mutaciones viven en lib/foro/api. */

export type DebateListItem = {
  id: string;
  title: string;
  status: DebateStatus;
  closesAt: string | null;
  createdAt: string;
  createdByName: string | null;
  linkedLabel: string | null;
  hearingTitle: string | null;
  argumentCount: number;
};

/**
 * Mini resumen de una audiencia, por orden de confianza: conclusiones firmadas
 * por una persona en la ficha, después el resumen del análisis de IA, después
 * la descripción de la reunión.
 */
function hearingSnippet(meeting: {
  description: string | null;
  hearingRecord: { conclusionsSummary: string | null; mainTopic: string } | null;
  analyses: { summary: string }[];
}): string | null {
  const source =
    meeting.hearingRecord?.conclusionsSummary?.trim() ||
    meeting.analyses[0]?.summary?.trim() ||
    meeting.description?.trim() ||
    meeting.hearingRecord?.mainTopic?.trim() ||
    null;
  if (!source) return null;
  return source.length > 420 ? `${source.slice(0, 420).trimEnd()}...` : source;
}

const hearingInclude = {
  select: {
    id: true,
    title: true,
    occurredAt: true,
    description: true,
    hearingRecord: { select: { conclusionsSummary: true, mainTopic: true } },
    analyses: { orderBy: { version: "desc" as const }, take: 1, select: { summary: true } }
  }
};

export async function listDebates(status?: DebateStatus): Promise<DebateListItem[]> {
  const where: Prisma.DebateWhereInput = status ? { status } : {};
  const debates = await prisma.debate.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      createdBy: { select: { name: true, lastName: true } },
      meeting: { select: { title: true } },
      proposal: { select: { title: true } },
      project: { select: { title: true, code: true } },
      _count: { select: { arguments: { where: { status: "VISIBLE", parentId: null } } } }
    }
  });

  return debates.map((debate) => ({
    id: debate.id,
    title: debate.title,
    status: debate.status,
    closesAt: debate.closesAt?.toISOString() ?? null,
    createdAt: debate.createdAt.toISOString(),
    createdByName: debate.createdBy ? fullName(debate.createdBy) : null,
    linkedLabel: debate.proposal
      ? `Propuesta: ${debate.proposal.title}`
      : debate.project
        ? `Proyecto ${debate.project.code}: ${debate.project.title}`
        : null,
    hearingTitle: debate.meeting?.title ?? null,
    argumentCount: debate._count.arguments
  }));
}

export type DebateArgumentItem = {
  id: string;
  stance: DebateStance;
  content: string;
  authorName: string | null;
  authorOccupation: string | null;
  createdAt: string;
  supportCount: number;
  viewerSupported: boolean;
  isOwn: boolean;
  hidden: boolean;
  hiddenReason: string | null;
};

export type DebateAnalysisReport = {
  lecturaGeneral: string;
  coherencias: string[];
  incongruencias: string[];
  vacios: string[];
  caminoConsenso: string | null;
};

export type DebateDetail = {
  id: string;
  title: string;
  context: string;
  status: DebateStatus;
  closesAt: string | null;
  createdAt: string;
  createdByName: string | null;
  linkedLabel: string | null;
  hearing: { id: string; title: string; occurredAt: string | null; summary: string | null } | null;
  analysis: {
    report: DebateAnalysisReport;
    generatedAt: string;
    argumentCount: number;
    /** Argumentos visibles nuevos desde que se generó (0 = al día). */
    newArgumentsSince: number;
  } | null;
  arguments: DebateArgumentItem[];
};

/**
 * Detalle del debate. Los argumentos ocultos solo viajan a quien puede
 * moderar (y se marcan como tales); para el resto directamente no existen.
 */
export async function getDebateDetail(
  id: string,
  viewer: { userId: string; canModerate: boolean }
): Promise<DebateDetail | null> {
  const debate = await prisma.debate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, lastName: true } },
      meeting: hearingInclude,
      proposal: { select: { title: true } },
      project: { select: { title: true, code: true } },
      arguments: {
        where: {
          parentId: null,
          ...(viewer.canModerate ? {} : { status: "VISIBLE" as const })
        },
        include: {
          author: { select: { name: true, lastName: true, occupation: true } },
          supports: { select: { userId: true } }
        }
      }
    }
  });

  if (!debate) return null;

  const argumentItems = debate.arguments
    .map((argument) => ({
      id: argument.id,
      stance: argument.stance,
      content: argument.content,
      authorName: argument.author ? fullName(argument.author) : null,
      authorOccupation: argument.author?.occupation ?? null,
      createdAt: argument.createdAt.toISOString(),
      supportCount: argument.supports.length,
      viewerSupported: argument.supports.some((support) => support.userId === viewer.userId),
      isOwn: false,
      hidden: argument.status === "HIDDEN",
      hiddenReason: argument.hiddenReason,
      _authorId: argument.authorId
    }))
    .sort((a, b) => b.supportCount - a.supportCount || a.createdAt.localeCompare(b.createdAt))
    .map(({ _authorId, ...item }) => ({ ...item, isOwn: _authorId === viewer.userId }));

  const visibleCount = argumentItems.filter((item) => !item.hidden).length;
  const report = debate.analysis as DebateAnalysisReport | null;

  return {
    id: debate.id,
    title: debate.title,
    context: debate.context,
    status: debate.status,
    closesAt: debate.closesAt?.toISOString() ?? null,
    createdAt: debate.createdAt.toISOString(),
    createdByName: debate.createdBy ? fullName(debate.createdBy) : null,
    linkedLabel: debate.proposal
      ? `Propuesta: ${debate.proposal.title}`
      : debate.project
        ? `Proyecto ${debate.project.code}: ${debate.project.title}`
        : null,
    hearing: debate.meeting
      ? {
          id: debate.meeting.id,
          title: debate.meeting.title,
          occurredAt: debate.meeting.occurredAt?.toISOString() ?? null,
          summary: hearingSnippet(debate.meeting)
        }
      : null,
    analysis:
      report && debate.analysisAt
        ? {
            report,
            generatedAt: debate.analysisAt.toISOString(),
            argumentCount: debate.analysisArgumentCount ?? 0,
            newArgumentsSince: Math.max(0, visibleCount - (debate.analysisArgumentCount ?? 0))
          }
        : null,
    arguments: argumentItems
  };
}

export type LinkableItems = {
  proposals: { id: string; title: string }[];
  projects: { id: string; label: string }[];
  /** Audiencias elegibles como origen del debate, con su mini resumen. */
  hearings: { id: string; title: string; occurredAt: string | null; summary: string | null }[];
};

/** Opciones para anclar un debate: audiencia de origen (obligatoria) y
 *  propuesta/proyecto (opcional). */
export async function listLinkableItems(): Promise<LinkableItems> {
  const [proposals, projects, hearings] = await Promise.all([
    prisma.proposal.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true }
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true, code: true }
    }),
    prisma.meeting.findMany({
      where: { kind: "PUBLIC_HEARING" },
      orderBy: { occurredAt: "desc" },
      take: 60,
      select: hearingInclude.select
    })
  ]);

  return {
    proposals,
    projects: projects.map((project) => ({ id: project.id, label: `${project.code} · ${project.title}` })),
    hearings: hearings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      occurredAt: meeting.occurredAt?.toISOString() ?? null,
      summary: hearingSnippet(meeting)
    }))
  };
}
