import { ProposalSource, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { listInclude, listProposals, toListItem } from "@/lib/proposals/data";
import { PROJECT_STATUSES } from "@/lib/proposals/shared";

const createProposalSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(4000),
  source: z.nativeEnum(ProposalSource).optional().default(ProposalSource.OFFICIAL),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ proposals: [], isLive: false });
  }

  const stage = new URL(request.url).searchParams.get("stage");

  try {
    const proposals = await listProposals(stage === "projects" ? PROJECT_STATUSES : undefined);

    return NextResponse.json({ proposals, isLive: true });
  } catch (error) {
    console.error("Unable to list proposals.", error);
    return NextResponse.json({ error: "No pudimos leer las propuestas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  try {
    const payload = createProposalSchema.parse(await request.json());

    const proposal = await prisma.proposal.create({
      data: {
        title: payload.title,
        description: payload.description,
        status: ProposalStatus.SUBMITTED,
        source: payload.source,
        latitude: payload.latitude,
        longitude: payload.longitude
      },
      include: listInclude
    });

    return NextResponse.json({ proposal: toListItem(proposal) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Revisa los datos: titulo (min. 5 caracteres) y descripcion (min. 10) son obligatorios." },
        { status: 400 }
      );
    }

    console.error("Unable to create proposal.", error);
    return NextResponse.json({ error: "No pudimos guardar la propuesta." }, { status: 500 });
  }
}
