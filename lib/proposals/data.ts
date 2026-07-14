import type { Prisma, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PROJECT_STATUSES, type ProposalListItem } from "@/lib/proposals/shared";

/**
 * Acceso server-side a propuestas reales. Lo comparten la API /api/proposals y
 * las páginas server component (Proyectos y ficha).
 */

const listInclude = {
  _count: { select: { votes: true, comments: true } },
  citizenContributions: {
    select: { name: true, zone: true, axis: true },
    take: 1,
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.ProposalInclude;

type ProposalWithRelations = Prisma.ProposalGetPayload<{ include: typeof listInclude }>;

export function toListItem(proposal: ProposalWithRelations): ProposalListItem {
  const citizen = proposal.citizenContributions[0] ?? null;

  return {
    id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    status: proposal.status,
    source: proposal.source,
    latitude: proposal.latitude,
    longitude: proposal.longitude,
    createdAt: proposal.createdAt.toISOString(),
    votes: proposal._count.votes,
    comments: proposal._count.comments,
    citizen: citizen ? { name: citizen.name, zone: citizen.zone, axis: citizen.axis } : null
  };
}

export async function listProposals(statuses?: ProposalStatus[]): Promise<ProposalListItem[]> {
  const proposals = await prisma.proposal.findMany({
    where: statuses ? { status: { in: statuses } } : { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: listInclude
  });

  return proposals.map(toListItem);
}

export async function listProjectProposals(): Promise<ProposalListItem[]> {
  return listProposals(PROJECT_STATUSES);
}

export async function getProposalById(id: string): Promise<ProposalListItem | null> {
  const proposal = await prisma.proposal.findUnique({ where: { id }, include: listInclude });

  return proposal ? toListItem(proposal) : null;
}

export { listInclude };
