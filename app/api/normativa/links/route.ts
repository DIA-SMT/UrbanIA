import { NextResponse } from "next/server";
import { NormativeRelationshipType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  articleId: z.string().min(1).max(160),
  sourceType: z.enum(["project", "proposal", "hearing", "scenario", "document", "territory"]),
  sourceId: z.string().trim().min(1).max(160),
  relationshipType: z.nativeEnum(NormativeRelationshipType),
  notes: z.string().trim().max(600).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Relación inválida", detail: "Revisá el artículo, origen y tipo de relación." }, { status: 400 });
  try {
    const link = await prisma.normativeLink.upsert({ where: { sourceType_sourceId_articleId_relationshipType: { sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, articleId: parsed.data.articleId, relationshipType: parsed.data.relationshipType } }, update: { notes: parsed.data.notes || null }, create: { ...parsed.data, notes: parsed.data.notes || null, createdBy: "manual" } });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Manual normative link failed", error);
    return NextResponse.json({ error: "No se pudo guardar la relación", detail: "La estructura normativa debe estar migrada e importada antes de guardar relaciones." }, { status: 503 });
  }
}
