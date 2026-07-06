import { CitizenContributionKind, CitizenContributionStatus, ProposalSource, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const contributionSchema = z.object({
  kind: z.enum(["Propuesta", "Reclamo", "Aporte"]),
  name: z.string().trim().min(2).max(120),
  dni: z.string().trim().min(6).max(20),
  zone: z.string().trim().min(2).max(160),
  text: z.string().trim().min(10).max(4000),
  fileName: z.string().trim().max(240).optional().default(""),
  axis: z.string().trim().min(2).max(80),
  confidence: z.string().trim().min(2).max(40)
});

const kindToDb: Record<z.infer<typeof contributionSchema>["kind"], CitizenContributionKind> = {
  Propuesta: CitizenContributionKind.PROPOSAL,
  Reclamo: CitizenContributionKind.CLAIM,
  Aporte: CitizenContributionKind.CONTRIBUTION
};

const dbToKind: Record<CitizenContributionKind, z.infer<typeof contributionSchema>["kind"]> = {
  PROPOSAL: "Propuesta",
  CLAIM: "Reclamo",
  CONTRIBUTION: "Aporte"
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ contributions: [], isLive: false });
  }

  try {
    const contributions = await prisma.citizenContribution.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        proposal: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    return NextResponse.json({
      contributions: contributions.map((contribution) => ({
        id: contribution.id,
        kind: dbToKind[contribution.kind],
        name: contribution.name,
        dni: contribution.dni,
        zone: contribution.zone,
        text: contribution.text,
        fileName: contribution.fileName ?? "",
        axis: contribution.axis,
        confidence: contribution.confidence,
        status: contribution.status,
        createdAt: contribution.createdAt.toISOString(),
        proposal: contribution.proposal
          ? {
              id: contribution.proposal.id,
              title: contribution.proposal.title,
              description: contribution.proposal.description,
              status: contribution.proposal.status,
              createdAt: contribution.proposal.createdAt.toISOString()
            }
          : null
      })),
      isLive: true
    });
  } catch (error) {
    console.error("Unable to list citizen contributions.", error);
    return NextResponse.json({ error: "No pudimos leer los aportes ciudadanos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  try {
    const payload = contributionSchema.parse(await request.json());
    const title = `${payload.kind}: ${payload.zone}`;

    const contribution = await prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: {
          title,
          description: payload.text,
          status: ProposalStatus.SUBMITTED,
          source: ProposalSource.CITIZEN
        }
      });

      return tx.citizenContribution.create({
        data: {
          kind: kindToDb[payload.kind],
          name: payload.name,
          dni: payload.dni,
          zone: payload.zone,
          text: payload.text,
          fileName: payload.fileName || null,
          axis: payload.axis,
          confidence: payload.confidence,
          status: CitizenContributionStatus.LINKED_TO_PROPOSAL,
          proposalId: proposal.id
        },
        include: {
          proposal: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              createdAt: true
            }
          }
        }
      });
    });

    return NextResponse.json(
      {
        contribution: {
          id: contribution.id,
          kind: dbToKind[contribution.kind],
          name: contribution.name,
          dni: contribution.dni,
          zone: contribution.zone,
          text: contribution.text,
          fileName: contribution.fileName ?? "",
          axis: contribution.axis,
          confidence: contribution.confidence,
          status: contribution.status,
          createdAt: contribution.createdAt.toISOString(),
          proposal: contribution.proposal
            ? {
                id: contribution.proposal.id,
                title: contribution.proposal.title,
                description: contribution.proposal.description,
                status: contribution.proposal.status,
                createdAt: contribution.proposal.createdAt.toISOString()
              }
            : null
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Revisa los datos del formulario antes de guardar." }, { status: 400 });
    }

    console.error("Unable to save citizen contribution.", error);
    return NextResponse.json({ error: "No pudimos guardar el aporte ciudadano." }, { status: 500 });
  }
}
