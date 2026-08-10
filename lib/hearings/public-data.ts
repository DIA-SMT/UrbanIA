import "server-only";

import { prisma } from "@/lib/db/prisma";
import type {
  PublicHearingDetail,
  PublicHearingListItem,
  PublicHearingStatus
} from "@/lib/hearings/public-shared";

/**
 * Registro PUBLICO de audiencias, para el portal ciudadano.
 *
 * No reutiliza listHearings/getHearing a proposito: esas devuelven material de
 * trabajo interno (participantes con nombre, transcripcion textual, cruces con
 * normas en borrador, estado del procesamiento del audio y sus errores). Acá se
 * arma una vista propia con lo que la Municipalidad publica: cuando fue la
 * audiencia, de que se hablo y a que se llego.
 *
 * Lo que NUNCA sale de acá: participantes, transcripciones, archivos de audio,
 * cruces normativos y cualquier estado del pipeline de ingesta.
 */

/**
 * Traduce el estado interno al publico. Las audiencias que todavia se estan
 * procesando se muestran como realizadas: el vecino no tiene por que enterarse
 * del pipeline de transcripcion.
 */
function toPublicStatus(hearingStatus: string | null, occurredAt: Date | null): PublicHearingStatus {
  if (hearingStatus === "CANCELLED") return "CANCELADA";
  if (hearingStatus === "SCHEDULED") return "PROGRAMADA";
  if (hearingStatus === "COMPLETED" || hearingStatus === "PROCESSING" || hearingStatus === "LIVE") return "REALIZADA";
  // Sin estado cargado: lo decide la fecha.
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
      hearingRecord: { select: { conclusionsSummary: true, mainTopic: true } },
      analyses: { orderBy: { version: "desc" }, take: 1, select: { summary: true } }
    }
  });

  return meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    occurredAt: meeting.occurredAt?.toISOString() ?? null,
    location: cleaned(meeting.location),
    topic: readTopic(meeting.metadata) ?? cleaned(meeting.hearingRecord?.mainTopic),
    status: toPublicStatus(meeting.hearingStatus, meeting.occurredAt),
    hasRecord: Boolean(cleaned(meeting.hearingRecord?.conclusionsSummary) || cleaned(meeting.analyses[0]?.summary))
  }));
}

export async function getPublicHearing(id: string): Promise<PublicHearingDetail | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id, kind: "PUBLIC_HEARING" },
    select: {
      id: true,
      title: true,
      occurredAt: true,
      location: true,
      metadata: true,
      hearingStatus: true,
      hearingRecord: {
        select: { conclusionsSummary: true, agreements: true, nextSteps: true, mainTopic: true, secondaryTopics: true }
      },
      analyses: { orderBy: { version: "desc" }, take: 1, select: { summary: true, topics: true } }
    }
  });

  if (!meeting) return null;

  const analysis = meeting.analyses[0] ?? null;
  const analysisTopics = Array.isArray(analysis?.topics)
    ? (analysis.topics as unknown[]).filter((topic): topic is string => typeof topic === "string" && topic.trim().length > 0)
    : [];

  return {
    id: meeting.id,
    title: meeting.title,
    occurredAt: meeting.occurredAt?.toISOString() ?? null,
    location: cleaned(meeting.location),
    topic: readTopic(meeting.metadata) ?? cleaned(meeting.hearingRecord?.mainTopic),
    status: toPublicStatus(meeting.hearingStatus, meeting.occurredAt),
    summary: cleaned(analysis?.summary),
    topics: analysisTopics.length > 0 ? analysisTopics : (meeting.hearingRecord?.secondaryTopics ?? []),
    conclusions: cleaned(meeting.hearingRecord?.conclusionsSummary),
    agreements: cleaned(meeting.hearingRecord?.agreements),
    nextSteps: cleaned(meeting.hearingRecord?.nextSteps)
  };
}
