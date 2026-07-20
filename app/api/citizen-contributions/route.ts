import { CitizenContributionKind, CitizenContributionStatus, ProposalSource, ProposalStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/auth/session";
import { CONTRIBUTION_BLOCK_MESSAGE, moderateContribution } from "@/lib/moderation";
import { analyzeAggression } from "@/lib/ai/moderation-intent";
import { UNCLASSIFIED_AXIS } from "@/lib/citizen/contributions";
import { classifyContributionTopic } from "@/lib/ai/topic-classifier";

// name y dni NO se aceptan del cliente: salen de la cuenta del vecino, que los
// declaró una sola vez al registrarse.
// axis y confidence tampoco: el aporte entra sin clasificar y el eje lo asigna el
// equipo municipal al revisarlo. La heurística por palabras clave que hacía esto en
// la landing etiquetaba "Ambiente" cualquier texto que no matcheara nada.
const contributionSchema = z.object({
  kind: z.enum(["Propuesta", "Reclamo", "Aporte"]),
  zone: z.string().trim().min(2).max(160),
  text: z.string().trim().min(10).max(4000),
  fileName: z.string().trim().max(240).optional().default("")
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
        // El email vive en User: sin este join no hay forma de contactar al vecino.
        user: { select: { email: true } },
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
        axisReason: contribution.axisReason ?? "",
        axisConfirmed: contribution.axisConfirmed,
        confidence: contribution.confidence,
        status: contribution.status,
        // Los aportes anteriores al login obligatorio no tienen autor: sin email.
        email: contribution.user?.email ?? null,
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

  // Presentar requiere cuenta: la identidad sale de la sesión, no del formulario.
  const store = await cookies();
  const session = await readSessionToken(store.get(sessionCookieName)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Ingresá con tu cuenta para presentar una propuesta o reclamo." },
      { status: 401 }
    );
  }

  const author = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, dni: true }
  });

  if (!author) {
    return NextResponse.json({ error: "No encontramos tu cuenta. Volvé a ingresar." }, { status: 401 });
  }

  try {
    const payload = contributionSchema.parse(await request.json());

    const moderated = `${payload.text} ${payload.zone}`;
    const verdict = moderateContribution(moderated);

    if (verdict.blocked) {
      console.info("Aporte ciudadano bloqueado por moderacion lexica.", { matched: verdict.matched });
      return NextResponse.json({ error: verdict.message }, { status: 422 });
    }

    // En paralelo para no sumarle espera al vecino: la moderación por intención y la
    // sugerencia de eje son dos llamadas independientes. Si la moderación bloquea, la
    // sugerencia se descarta (una llamada barata desperdiciada, y sólo en los casos
    // bloqueados, que son la excepción).
    const [aggression, suggestion] = await Promise.all([
      analyzeAggression(moderated),
      classifyContributionTopic({ kind: payload.kind, zone: payload.zone, text: payload.text })
    ]);

    if (aggression.agresivo) {
      console.info("Aporte ciudadano bloqueado por intencion.", { tipo: aggression.tipo });
      return NextResponse.json({ error: CONTRIBUTION_BLOCK_MESSAGE }, { status: 422 });
    }

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
          name: author.name,
          dni: author.dni ?? "",
          zone: payload.zone,
          text: payload.text,
          fileName: payload.fileName || null,
          userId: session.userId,
          // Sugerencia de Migue, sin confirmar: la revisa una persona. Si el
          // clasificador falló o no supo, queda "Sin clasificar", que es la verdad.
          axis: suggestion?.axis ?? UNCLASSIFIED_AXIS,
          axisReason: suggestion?.reason || null,
          relatedTopic: suggestion?.relatedTopic ?? null,
          axisConfirmed: false,
          confidence: "",
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
