import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { extractFichaFromTranscript } from "@/lib/hearings/ficha-extract";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  transcript: z.string().trim().min(40).max(200000)
});

/**
 * "Completar con IA": extrae los campos de la ficha del tramo dictado. No
 * persiste (el cliente mergea sobre lo que el operador ya escribio y el
 * autoguardado lo guarda). La IA orienta; el operador corrige.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      { error: "IA no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Dictá o escribí un poco más para que Migue pueda completar." }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { id: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const ficha = await extractFichaFromTranscript(parsed.data.transcript);
    return NextResponse.json({ ficha });
  } catch (error) {
    console.error("No se pudo completar la ficha con IA", error);
    return NextResponse.json({ error: "No se pudo completar la ficha", detail: "Intentá nuevamente en unos segundos." }, { status: 502 });
  }
}
