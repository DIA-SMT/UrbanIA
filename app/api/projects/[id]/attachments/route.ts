import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import type { ProjectAttachmentView } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

function toView(attachment: { id: string; kind: string; name: string; excerpt: string | null; meetingId: string | null; createdAt: Date }): ProjectAttachmentView {
  return {
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    excerpt: attachment.excerpt,
    meetingId: attachment.meetingId,
    createdAt: attachment.createdAt.toISOString()
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ attachments: [], isLive: false });
  const { id } = await params;
  const attachments = await prisma.projectAttachment.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ attachments: attachments.map(toView), isLive: true });
}

const postSchema = z.object({
  kind: z.enum(["documento", "apunte", "acta"]),
  name: z.string().trim().min(1).max(300),
  excerpt: z.string().trim().max(4000).nullish(),
  meetingId: z.string().trim().min(1).max(60).nullish()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  try {
    const attachment = await prisma.projectAttachment.create({
      data: {
        projectId: id,
        kind: parsed.data.kind,
        name: parsed.data.name,
        excerpt: parsed.data.excerpt ?? null,
        meetingId: parsed.data.meetingId ?? null
      }
    });
    return NextResponse.json({ attachment: toView(attachment) }, { status: 201 });
  } catch (error) {
    console.error("No se pudo agregar el adjunto", error);
    return NextResponse.json({ error: "No se pudo agregar el adjunto" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const attachmentId = new URL(request.url).searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json({ error: "Falta el adjunto" }, { status: 400 });

  try {
    await prisma.projectAttachment.deleteMany({ where: { id: attachmentId, projectId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el adjunto", error);
    return NextResponse.json({ error: "No se pudo eliminar el adjunto" }, { status: 500 });
  }
}
