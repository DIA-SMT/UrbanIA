import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";


/**
 * Borra una devolucion. Solo quien la firmo.
 *
 * La comparacion es por userId contra la sesion. Antes era por nombre declarado
 * porque la cuenta institucional era compartida y "mismo userId" equivalia a que
 * cualquiera de la direccion borrara lo de cualquiera; con una cuenta por persona
 * el userId vuelve a ser la comparacion correcta, y ademas deja de ser
 * falsificable desde el cliente.
 *
 * Las devoluciones con userId en null (la cuenta se borro, ver el SetNull del
 * modelo) no las borra nadie por esta via: quedan como registro historico.
 */
export async function handleOpinionDelete(_request: Request, id: string, opinionId: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "projects.edit")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    // findFirst con projectId acota el borrado a la norma de la URL: sin eso, un
    // opinionId de otra norma se borraria igual.
    const opinion = await prisma.normOpinion.findFirst({
      where: { id: opinionId, projectId: id },
      select: { authorName: true, userId: true }
    });

    if (!opinion) {
      return NextResponse.json({ error: "Devolución inexistente" }, { status: 404 });
    }
    if (!opinion.userId || opinion.userId !== session.userId) {
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
