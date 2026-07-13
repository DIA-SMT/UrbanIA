import { ProposalSource, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const proposalSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(5000),
  neighborhood: z.string().trim().min(2).max(180),
  author: z.string().trim().min(2).max(140),
  responsible: z.string().trim().min(2).max(140),
  origin: z.enum(["Gabinete", "Area tecnica", "Concejo", "Audiencia publica", "Cidituc", "Landing ciudadana", "Normativa", "Caso comparado"]),
  status: z.enum(["En analisis", "Planificado", "En ejecucion", "Realizado"])
});

const statusToDb: Record<z.infer<typeof proposalSchema>["status"], ProposalStatus> = {
  "En analisis": ProposalStatus.UNDER_REVIEW,
  Planificado: ProposalStatus.APPROVED,
  "En ejecucion": ProposalStatus.IN_PROGRESS,
  Realizado: ProposalStatus.COMPLETED
};

const sourceToDb: Record<z.infer<typeof proposalSchema>["origin"], ProposalSource> = {
  Gabinete: ProposalSource.CABINET,
  "Area tecnica": ProposalSource.TECHNICAL_TEAM,
  Concejo: ProposalSource.OFFICIAL,
  "Audiencia publica": ProposalSource.OFFICIAL,
  Cidituc: ProposalSource.CITIZEN,
  "Landing ciudadana": ProposalSource.CITIZEN,
  Normativa: ProposalSource.OFFICIAL,
  "Caso comparado": ProposalSource.TECHNICAL_TEAM
};

function formatProposal(proposal: Awaited<ReturnType<typeof findProposals>>[number]) {
  const contribution = proposal.citizenContributions[0];
  const neighborhood = contribution?.zone ?? "Sin ubicacion registrada";
  const axis = contribution?.axis ?? "";
  const layer = mapAxisToLayer(axis);
  const origin = mapSourceToOrigin(proposal.source);

  return {
    id: proposal.id,
    title: proposal.title,
    layer,
    status: mapStatusToUi(proposal.status),
    neighborhood,
    author: proposal.createdBy?.name ?? contribution?.name ?? mapSourceToAuthor(proposal.source),
    responsible: mapSourceToResponsible(proposal.source),
    origin,
    promoterArea: origin === "Landing ciudadana" ? "Portal ciudadano UrbanIA" : mapSourceToResponsible(proposal.source),
    description: proposal.description,
    objective: proposal.description,
    impact: axis ? [`Eje detectado: ${axis}`] : ["Pendiente de clasificacion tecnica"],
    risks: ["Pendiente de revision municipal"],
    nextSteps: ["Revision tecnica", "Cruce normativo", "Definicion de area responsable"],
    votes: proposal._count.votes,
    comments: proposal._count.comments + proposal._count.citizenContributions,
    budget: "A estimar",
    timeline: "Pendiente de evaluacion",
    position: [proposal.latitude ?? -26.8241, proposal.longitude ?? -65.2226],
    codeRelation: "Pendiente de carga normativa",
    technicalJustification: proposal.description,
    attachedDocuments: contribution?.fileName ? [contribution.fileName] : [],
    reviewStatus: mapStatusToReview(proposal.status),
    aiNormativeImpact: "Sin analisis automatico cargado para esta propuesta."
  };
}

async function findProposals() {
  return prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true } },
      citizenContributions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { comments: true, votes: true, citizenContributions: true } }
    }
  });
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ proposals: [], isLive: false });
  }

  try {
    const proposals = await findProposals();
    return NextResponse.json({ proposals: proposals.map(formatProposal), isLive: true });
  } catch (error) {
    console.error("Unable to list proposals.", error);
    return NextResponse.json({ error: "No pudimos leer las propuestas desde la base de datos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  try {
    const payload = proposalSchema.parse(await request.json());
    const proposal = await prisma.proposal.create({
      data: {
        title: payload.title,
        description: `${payload.description}\n\nUbicacion: ${payload.neighborhood}\nActor proponente: ${payload.author}\nArea responsable: ${payload.responsible}`,
        status: statusToDb[payload.status],
        source: sourceToDb[payload.origin]
      },
      include: {
        createdBy: { select: { name: true } },
        citizenContributions: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { comments: true, votes: true, citizenContributions: true } }
      }
    });

    return NextResponse.json({ proposal: formatProposal(proposal) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Revisa los datos de la propuesta antes de guardar." }, { status: 400 });
    }

    console.error("Unable to save proposal.", error);
    return NextResponse.json({ error: "No pudimos guardar la propuesta en la base de datos." }, { status: 500 });
  }
}

function mapStatusToUi(status: ProposalStatus) {
  if (status === ProposalStatus.IN_PROGRESS) return "En ejecucion";
  if (status === ProposalStatus.COMPLETED) return "Realizado";
  if (status === ProposalStatus.APPROVED || status === ProposalStatus.FEASIBLE) return "Planificado";
  return "En analisis";
}

function mapStatusToReview(status: ProposalStatus) {
  if (status === ProposalStatus.NEEDS_DATA) return "Observada";
  if (status === ProposalStatus.APPROVED || status === ProposalStatus.FEASIBLE) return "Apta para escenario";
  if (status === ProposalStatus.IN_PROGRESS || status === ProposalStatus.COMPLETED) return "Elevada a gabinete";
  return "Pendiente tecnico";
}

function mapSourceToOrigin(source: ProposalSource) {
  if (source === ProposalSource.CABINET) return "Gabinete";
  if (source === ProposalSource.TECHNICAL_TEAM) return "Area tecnica";
  if (source === ProposalSource.OFFICIAL) return "Concejo";
  return "Landing ciudadana";
}

function mapSourceToAuthor(source: ProposalSource) {
  if (source === ProposalSource.CABINET) return "Gabinete urbano";
  if (source === ProposalSource.TECHNICAL_TEAM) return "Equipo tecnico";
  if (source === ProposalSource.OFFICIAL) return "Area municipal";
  return "Ciudadania";
}

function mapSourceToResponsible(source: ProposalSource) {
  if (source === ProposalSource.TECHNICAL_TEAM) return "Area tecnica";
  if (source === ProposalSource.CABINET) return "Gabinete";
  if (source === ProposalSource.OFFICIAL) return "Gestion municipal";
  return "Planeamiento Urbano";
}

function mapAxisToLayer(axis: string) {
  const normalized = axis.toLowerCase();

  if (normalized.includes("ambiente")) return "Espacios verdes";
  if (normalized.includes("movilidad")) return "Transporte";
  if (normalized.includes("suelo")) return "Zonificacion";
  if (normalized.includes("riesgo")) return "Riesgos";
  return "Equipamiento";
}
