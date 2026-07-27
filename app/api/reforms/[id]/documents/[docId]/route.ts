import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { removeNormDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

/**
 * Borra un antecedente de la reforma.
 *
 * Si de ese PDF salieron normas, NO se borra nada: se responde 409 con la
 * lista, para que la persona decida. Borrar el antecedente por debajo dejaria
 * esas normas sin su evidencia de origen, que es justamente lo que este
 * modulo existe para conservar.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, docId } = await params;

  try {
    const document = await prisma.reformDocument.findFirst({
      where: { id: docId, reformId: id },
      select: { id: true, name: true, storagePath: true }
    });
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    if (document.storagePath) {
      const dependientes = await prisma.projectAttachment.findMany({
        where: { storagePath: document.storagePath },
        select: { project: { select: { id: true, code: true, title: true } } }
      });

      if (dependientes.length) {
        const normas = dependientes.map((row) => row.project);
        return NextResponse.json(
          {
            error: "El documento tiene normas asociadas",
            detail: `De "${document.name}" ${normas.length === 1 ? "salió 1 norma" : `salieron ${normas.length} normas`}. Eliminá esas normas primero, o dejá el documento como antecedente.`,
            norms: normas
          },
          { status: 409 }
        );
      }

      // Best-effort: que falle el bucket no puede impedir borrar la fila.
      await removeNormDocument(document.storagePath).catch((error) =>
        console.error("No se pudo borrar el objeto del bucket", error)
      );
    }

    await prisma.reformDocument.delete({ where: { id: document.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el documento de la reforma", error);
    return NextResponse.json({ error: "No se pudo eliminar el documento" }, { status: 500 });
  }
}
