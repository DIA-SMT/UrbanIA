import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const removeSchema = z.object({ voterName: z.string().trim().min(1).max(120) });

/**
 * Borra una devolucion. Solo quien la firmo.
 *
 * La comparacion es por NOMBRE declarado y no por cuenta ni por rol: la cuenta
 * institucional es compartida (y ademas es ADMIN), asi que tanto "mismo userId"
 * como "es ADMIN" equivalen a que cualquiera borre lo de cualquiera. Con el
 * modelo declarativo esto tampoco es infalsificable, pero exige elegir
 * activamente el nombre del otro para borrar lo suyo, que ya no es un descuido.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; opinionId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, opinionId } = await params;
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Elegí tu nombre para borrar tu devolución." },
      { status: 400 }
    );
  }

  try {
    // findFirst con projectId acota el borrado a la norma de la URL: sin eso, un
    // opinionId de otra norma se borraria igual.
    const opinion = await prisma.normOpinion.findFirst({
      where: { id: opinionId, projectId: id },
      select: { authorName: true }
    });

    if (!opinion) {
      return NextResponse.json({ error: "Devolución inexistente" }, { status: 404 });
    }
    if (opinion.authorName !== parsed.data.voterName) {
      return NextResponse.json(
        { error: "Sin permisos", detail: `Solo ${opinion.authorName} puede borrar esta devolución.` },
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
