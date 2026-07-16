import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  meetingId: z.string().trim().min(1).max(60).optional(),
  newMeeting: z.object({ title: z.string().trim().min(1).max(200), meetingDate: z.string().trim().min(1) }).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id }, select: { title: true, summary: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  try {
    // Resolver la reunion: existente o nueva. CabinetIdea.meetingId es obligatorio.
    let meetingId = parsed.data.meetingId ?? null;
    if (!meetingId && parsed.data.newMeeting) {
      const date = new Date(parsed.data.newMeeting.meetingDate);
      const meeting = await prisma.cabinetMeeting.create({
        data: { title: parsed.data.newMeeting.title, meetingDate: Number.isNaN(date.getTime()) ? new Date() : date }
      });
      meetingId = meeting.id;
    }
    if (!meetingId) {
      return NextResponse.json({ error: "Elegi o crea una reunion de gabinete" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.cabinetIdea.create({
        data: {
          meetingId,
          projectId: id,
          title: project.title,
          description: project.summary.slice(0, 4000)
        }
      }),
      prisma.project.update({ where: { id }, data: { stage: "CABINET_REVIEW" } })
    ]);

    return NextResponse.json({ ok: true, meetingId });
  } catch (error) {
    console.error("No se pudo elevar el proyecto a gabinete", error);
    return NextResponse.json({ error: "No se pudo elevar el proyecto a gabinete" }, { status: 500 });
  }
}
