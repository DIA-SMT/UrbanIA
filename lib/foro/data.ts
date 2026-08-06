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
  argumentCount: number;
};

export async function listDebates(status?: DebateStatus): Promise<DebateListItem[]> {
  const where: Prisma.DebateWhereInput = status ? { status } : {};
  const debates = await prisma.debate.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      createdBy: { select: { name: true, lastName: true } },
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

export type DebateDetail = {
  id: string;
  title: string;
  context: string;
  status: DebateStatus;
  closesAt: string | null;
  createdAt: string;
  createdByName: string | null;
  linkedLabel: string | null;
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
    arguments: argumentItems
  };
}

export type LinkableItems = {
  proposals: { id: string; title: string }[];
  projects: { id: string; label: string }[];
};

/** Opciones para anclar un debate a algo de la cartera (form de nuevo debate). */
export async function listLinkableItems(): Promise<LinkableItems> {
  const [proposals, projects] = await Promise.all([
    prisma.proposal.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true }
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true, code: true }
    })
  ]);

  return {
    proposals,
    projects: projects.map((project) => ({ id: project.id, label: `${project.code} · ${project.title}` }))
  };
}
