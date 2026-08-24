"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

/*
 * Acciones de servidor de la Fabrica de Normas.
 *
 * Van como Server Actions y NO como una ruta de API a proposito: el plan Hobby
 * de Vercel admite 12 funciones serverless por deploy, cada route.ts cuenta una,
 * y el proyecto ya esta en 12 de 12. Una accion viaja con el bundle de la pagina
 * y no suma funcion.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Deja registrado en que audiencia se presento un documento de la reforma.
 *
 * Es el vinculo que convierte al PDF en parte de un expediente: un documento
 * llega a la reforma porque alguien lo expuso en una audiencia publica. Pasar
 * `null` lo desasigna, para poder corregir una asignacion equivocada.
 */
export async function asignarAudienciaADocumento(documentId: string, meetingId: string | null): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Iniciá sesión para asignar el documento." };
  if (!hasPermission(session, "norms.edit")) {
    return { ok: false, error: "No tenés permiso para editar la reforma." };
  }

  const document = await prisma.reformDocument.findUnique({
    where: { id: documentId },
    select: { id: true, reformId: true }
  });
  if (!document) return { ok: false, error: "Ese documento ya no existe." };

  // La audiencia tiene que existir y ser una audiencia publica: sin este
  // chequeo, un id cualquiera dejaria el documento apuntando a la nada.
  if (meetingId) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, kind: "PUBLIC_HEARING" },
      select: { id: true }
    });
    if (!meeting) return { ok: false, error: "Esa audiencia no existe." };
  }

  try {
    await prisma.reformDocument.update({ where: { id: documentId }, data: { meetingId } });
  } catch (error) {
    console.error("No se pudo asignar la audiencia al documento", error);
    return { ok: false, error: "No se pudo guardar la asignación." };
  }

  revalidatePath(`/normas/${document.reformId}`);
  if (meetingId) revalidatePath(`/audiencias/${meetingId}`);
  return { ok: true };
}
