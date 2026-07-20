import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** Borra una devolucion. Solo su autor o un ADMIN. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; opinionId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, opinionId } = await params;

  try {
    // findFirst con projectId acota el borrado a la norma de la URL: sin eso, un
    // opinionId de otra norma se borraria igual.
    const opinion = await prisma.normOpinion.findFirst({
      where: { id: opinionId, projectId: id },
      select: { userId: true }
    });

    if (!opinion) {
      return NextResponse.json({ error: "Devolución inexistente" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && opinion.userId !== session.userId) {
      return NextResponse.json(
        { error: "Sin permisos", detail: "Solo podés borrar tus propias devoluciones." },
        { status: 403 }
      );
    }

    await prisma.normOpinion.delete({ where: { id: opinionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo borrar la opinión", error);
    return NextResponse.json({ error: "No se pudo borrar la devolución" }, { status: 500 });
  }
}
