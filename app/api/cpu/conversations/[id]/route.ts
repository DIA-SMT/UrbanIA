import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { resolveCpuOwner } from "@/lib/cpu/owner";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  archived: z.boolean().optional(),
  title: z.string().trim().min(1).max(120).optional()
});

async function findOwnedConversation(id: string) {
  const owner = await resolveCpuOwner(false);
  if (!owner.ownerKey) {
    return null;
  }
  const conversation = await prisma.cpuConversation.findUnique({ where: { id } });
  if (!conversation || conversation.ownerKey !== owner.ownerKey) {
    return null;
  }
  return conversation;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await findOwnedConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const messages = await prisma.cpuMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      archived: conversation.archived,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations,
      retrieved: message.retrieved,
      isError: message.isError,
      createdAt: message.createdAt
    }))
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await findOwnedConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || (parsed.data.archived === undefined && parsed.data.title === undefined)) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const updated = await prisma.cpuConversation.update({
    where: { id: conversation.id },
    data: {
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {})
    },
    select: { id: true, title: true, archived: true, createdAt: true, updatedAt: true }
  });

  return NextResponse.json({ conversation: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await findOwnedConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  await prisma.cpuConversation.delete({ where: { id: conversation.id } });

  return NextResponse.json({ ok: true });
}
