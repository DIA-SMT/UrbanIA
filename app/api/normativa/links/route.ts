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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Relación inválida", detail: "Revisá el artículo, origen y tipo de relación." }, { status: 400 });
  try {
    const link = await prisma.normativeLink.upsert({ where: { sourceType_sourceId_articleId_relationshipType: { sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, articleId: parsed.data.articleId, relationshipType: parsed.data.relationshipType } }, update: { notes: parsed.data.notes || null }, create: { ...parsed.data, notes: parsed.data.notes || null, createdBy: "manual" } });
    const withArticle = await prisma.normativeLink.findUnique({ where: { id: link.id }, include: { article: { select: { articleNumber: true, title: true } } } });
    return NextResponse.json(withArticle ?? link, { status: 201 });
  } catch (error) {
    console.error("Manual normative link failed", error);
    return NextResponse.json({ error: "No se pudo guardar la relación", detail: "La estructura normativa debe estar migrada e importada antes de guardar relaciones." }, { status: 503 });
  }
}

// Lista los anclajes de un origen (ej. sourceType=project&sourceId=<id>).
export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ links: [], isLive: false });
  }
  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get("sourceType");
  const sourceId = searchParams.get("sourceId");
  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "Faltan parámetros sourceType y sourceId" }, { status: 400 });
  }

  try {
    const links = await prisma.normativeLink.findMany({
      where: { sourceType, sourceId },
      include: { article: { select: { articleNumber: true, title: true } } },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json({
      links: links.map((link) => ({
        id: link.id,
        articleId: link.articleId,
        articleNumber: link.article.articleNumber,
        articleTitle: link.article.title ?? `Artículo ${link.article.articleNumber}`,
        relationshipType: link.relationshipType,
        notes: link.notes,
        createdBy: link.createdBy
      })),
      isLive: true
    });
  } catch (error) {
    console.error("No se pudieron listar los anclajes", error);
    return NextResponse.json({ links: [], isLive: false });
  }
}

// Elimina un anclaje por id (?id=).
export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id del anclaje" }, { status: 400 });
  }
  try {
    await prisma.normativeLink.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el anclaje", error);
    return NextResponse.json({ error: "No se pudo eliminar el anclaje" }, { status: 500 });
  }
}
