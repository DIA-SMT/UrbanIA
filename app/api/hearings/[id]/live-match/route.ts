import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { matchTranscriptWindow, persistDetectedMatches } from "@/lib/hearings/live-match";
import { syncRecordLifecycle } from "@/lib/hearings/record";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  window: z.string().trim().min(20).max(4000),
  atMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional()
});

/**
 * Machea el ultimo tramo transcripto contra las mininormas del codigo nuevo
 * que debate esta audiencia, y persiste los cruces nuevos. Sugerencias para el
 * equipo; no deciden nada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true, reformId: true, hearingStatus: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
    if (!meeting.reformId) {
      return NextResponse.json({ error: "La audiencia no tiene un código nuevo asociado" }, { status: 422 });
    }

    // Al primer tramo, la audiencia pasa a estar en vivo.
    if (meeting.hearingStatus !== "LIVE" && meeting.hearingStatus !== "COMPLETED") {
      await prisma.meeting.update({ where: { id }, data: { hearingStatus: "LIVE", status: "PROCESSING" } });
      await syncRecordLifecycle(id, "LIVE");
    }

    const detected = await matchTranscriptWindow({ reformId: meeting.reformId, window: parsed.data.window });
    const matches = await persistDetectedMatches(id, detected, parsed.data.atMs ?? null);

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("No se pudo machear el tramo de la audiencia", error);
    return NextResponse.json({ error: "No se pudo machear el tramo" }, { status: 502 });
  }
}
