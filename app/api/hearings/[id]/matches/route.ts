import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { HearingMatchView } from "@/lib/hearings/shared";

export const dynamic = "force-dynamic";

/** Cruces audiencia <-> mininorma persistidos, para recargar el panel en vivo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ matches: [], isLive: false });
  }

  const { id } = await params;
  try {
    const rows = await prisma.hearingNormMatch.findMany({
      where: { meetingId: id },
      include: { norm: { select: { code: true, title: true, articleNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });

    const matches: HearingMatchView[] = rows.map((row) => ({
      id: row.id,
      normId: row.projectId,
      code: row.norm.code,
      title: row.norm.title,
      articleNumber: row.norm.articleNumber,
      fragment: row.fragment,
      stance: row.stance,
      confidence: row.confidence,
      atMs: row.atMs,
      createdAt: row.createdAt.toISOString()
    }));

    return NextResponse.json({ matches, isLive: true });
  } catch (error) {
    console.error("No se pudieron listar los cruces de la audiencia", error);
    return NextResponse.json({ matches: [], isLive: false });
  }
}
