import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { applyOwnerCookie, resolveCpuOwner } from "@/lib/cpu/owner";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "true";
  const owner = await resolveCpuOwner(true);

  const conversations = await prisma.cpuConversation.findMany({
    where: { ownerKey: owner.ownerKey, archived },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } }
    }
  });

  const response = NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      archived: conversation.archived,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation._count.messages
    }))
  });

  return applyOwnerCookie(response, owner);
}
