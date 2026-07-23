import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { getHearing } from "@/lib/hearings/data";
import { removeHearingDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

/**
 * Elimina un documento adjunto: lo borra del bucket de Supabase Storage y lo
 * saca de metadata.documents. Devuelve la audiencia actualizada.
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
    const meeting = await prisma.meeting.findFirst({ where: { id, kind: "PUBLIC_HEARING" }, select: { metadata: true } });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const previousMetadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};
    const previousDocuments = Array.isArray(previousMetadata.documents) ? (previousMetadata.documents as Prisma.JsonArray) : [];

    const target = previousDocuments.find(
      (entry) => entry && typeof entry === "object" && !Array.isArray(entry) && (entry as Prisma.JsonObject).id === docId
    ) as Prisma.JsonObject | undefined;
    if (!target) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    const storagePath = typeof target.storagePath === "string" ? target.storagePath : null;
    if (storagePath) {
      // Si el borrado del objeto falla, no cortamos: igual sacamos el registro.
      await removeHearingDocument(storagePath).catch((error) => console.error("No se pudo borrar el objeto del bucket", error));
    }

    const remaining = previousDocuments.filter(
      (entry) => !(entry && typeof entry === "object" && !Array.isArray(entry) && (entry as Prisma.JsonObject).id === docId)
    );

    await prisma.meeting.update({
      where: { id },
      data: { metadata: { ...previousMetadata, documents: remaining } }
    });

    const hearing = await getHearing(id);
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudo eliminar el documento de la audiencia", error);
    return NextResponse.json({ error: "No se pudo eliminar el documento" }, { status: 500 });
  }
}
