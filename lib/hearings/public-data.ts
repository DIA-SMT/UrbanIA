import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { PublicHearingListItem, PublicHearingStatus } from "@/lib/hearings/public-shared";

/**
 * Registro PUBLICO de audiencias, para el portal ciudadano.
 *
 * No reutiliza listHearings a proposito: esa devuelve material de trabajo
 * interno (participantes con nombre, transcripcion textual, cruces con normas
 * en borrador, estado del procesamiento del audio y sus errores). Acá sale
 * SOLO lo que la Municipalidad publica: cuando fue la audiencia, donde, de que
 * se hablo y el PDF del resumen ejecutivo ya aprobado.
 *
 * El resumen NO se genera al vuelo: se muestra el archivo que un funcionario
 * reviso y publico desde el detalle interno.
 */

/**
 * Traduce el estado interno al publico. Las audiencias en proceso se muestran
 * como realizadas: el vecino no tiene por que enterarse del pipeline de
 * transcripcion ni de si fallo.
 */
function toPublicStatus(hearingStatus: string | null, occurredAt: Date | null): PublicHearingStatus {
  if (hearingStatus === "CANCELLED") return "CANCELADA";
  if (hearingStatus === "SCHEDULED") return "PROGRAMADA";
  if (hearingStatus === "COMPLETED" || hearingStatus === "PROCESSING" || hearingStatus === "LIVE") return "REALIZADA";
  return occurredAt && occurredAt.getTime() > Date.now() ? "PROGRAMADA" : "REALIZADA";
}

function readTopic(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).topic;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function cleaned(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export async function listPublicHearings(): Promise<PublicHearingListItem[]> {
  const meetings = await prisma.meeting.findMany({
    where: { kind: "PUBLIC_HEARING" },
    orderBy: [{ occurredAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      occurredAt: true,
      location: true,
      metadata: true,
      hearingStatus: true,
      publicSummaryUrl: true,
      publicSummaryAt: true,
      hearingRecord: { select: { mainTopic: true } }
    }
  });

  return meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    occurredAt: meeting.occurredAt?.toISOString() ?? null,
    location: cleaned(meeting.location),
    topic: readTopic(meeting.metadata) ?? cleaned(meeting.hearingRecord?.mainTopic),
    status: toPublicStatus(meeting.hearingStatus, meeting.occurredAt),
    summaryUrl: cleaned(meeting.publicSummaryUrl),
    summaryPublishedAt: meeting.publicSummaryAt?.toISOString() ?? null
  }));
}
