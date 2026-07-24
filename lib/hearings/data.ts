import "server-only";

import { Prisma, type HearingSource, type HearingStatus, type ProcessingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toHearingConclusions, toHearingFicha } from "@/lib/hearings/shared";
import {
  conclusionsFromRecord,
  documentsFromRecord,
  fichaFromRecord,
  lifecycleFromStatus,
  syncRecordLifecycle
} from "@/lib/hearings/record";
import { isIngestStalled } from "@/lib/hearings/ingest-job";
import type {
  HearingActionItemView,
  HearingAnalysisView,
  HearingCounts,
  HearingDetail,
  HearingDocumentView,
  HearingInsightView,
  HearingListItem,
  HearingMatchView,
  HearingMediaView,
  HearingParticipantView,
  HearingTranscriptSegmentView
} from "@/lib/hearings/shared";

/**
 * Acceso server-side al registro de audiencias. Reutiliza el modelo Meeting
 * (kind PUBLIC_HEARING) y espeja el estilo de lib/projects/data.ts.
 */

/** El estado de audiencia puede venir nulo en meetings previos: se deriva del ProcessingStatus. */
function resolveHearingStatus(hearingStatus: HearingStatus | null, status: ProcessingStatus): HearingStatus {
  if (hearingStatus) return hearingStatus;
  switch (status) {
    case "READY":
      return "COMPLETED";
    case "PROCESSING":
      return "PROCESSING";
    case "ERROR":
      return "PROCESSING";
    default:
      return "SCHEDULED";
  }
}

const listInclude = {
  reform: { select: { id: true, code: true, title: true } },
  _count: { select: { normMatches: true, participants: true } }
} satisfies Prisma.MeetingInclude;

type MeetingListPayload = Prisma.MeetingGetPayload<{ include: typeof listInclude }>;

/** Lee un string de metadata (JSON), o null. */
function readMetaString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, Prisma.JsonValue>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toListItem(meeting: MeetingListPayload): HearingListItem {
  const resolved = resolveHearingStatus(meeting.hearingStatus, meeting.status);
  const processing = resolved === "PROCESSING";
  const ingestError = processing ? readMetaString(meeting.metadata, "error") : null;
  return {
    id: meeting.id,
    title: meeting.title,
    occurredAt: meeting.occurredAt ? meeting.occurredAt.toISOString() : null,
    hearingStatus: resolved,
    location: meeting.location,
    reformId: meeting.reformId,
    reformCode: meeting.reform?.code ?? null,
    reformTitle: meeting.reform?.title ?? null,
    topic: readMetaString(meeting.metadata, "topic"),
    ingestError,
    // Sin error registrado pero sin latido: el job murio con el proceso.
    ingestStalled: processing && !ingestError && isIngestStalled(meeting.metadata, meeting.updatedAt),
    ingestWarning: readMetaString(meeting.metadata, "ingestWarning"),
    matchCount: meeting._count.normMatches,
    participantCount: meeting._count.participants
  };
}

export type HearingFilters = { status?: HearingStatus; reformId?: string };

export async function listHearings(filters: HearingFilters = {}): Promise<HearingListItem[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      kind: "PUBLIC_HEARING",
      ...(filters.status ? { hearingStatus: filters.status } : {}),
      ...(filters.reformId ? { reformId: filters.reformId } : {})
    },
    include: listInclude,
    // occurredAt desc con nulls al final.
    orderBy: [{ occurredAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200
  });

  return meetings.map(toListItem);
}

export async function getHearingCounts(): Promise<HearingCounts> {
  // Se resuelve el estado en memoria (no groupBy sobre la columna cruda) para
  // contar tambien las audiencias de flujos previos con hearingStatus nulo,
  // que igual aparecen en la lista con su estado derivado.
  const meetings = await prisma.meeting.findMany({
    where: { kind: "PUBLIC_HEARING" },
    select: { hearingStatus: true, status: true }
  });

  const counts: HearingCounts = { upcoming: 0, processing: 0, completed: 0 };
  for (const meeting of meetings) {
    const status = resolveHearingStatus(meeting.hearingStatus, meeting.status);
    if (status === "SCHEDULED") counts.upcoming += 1;
    else if (status === "LIVE" || status === "PROCESSING") counts.processing += 1;
    else if (status === "COMPLETED") counts.completed += 1;
  }
  return counts;
}

function asStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Documentos adjuntos guardados en metadata.documents (Supabase Storage). */
function readDocuments(value: Prisma.JsonValue | undefined): HearingDocumentView[] {
  if (!Array.isArray(value)) return [];
  const documents: HearingDocumentView[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, Prisma.JsonValue>;
    const id = typeof record.id === "string" ? record.id : null;
    const fileName = typeof record.fileName === "string" ? record.fileName : null;
    const url = typeof record.url === "string" ? record.url : null;
    const storagePath = typeof record.storagePath === "string" ? record.storagePath : null;
    if (!id || !fileName || !url || !storagePath) continue;
    documents.push({
      id,
      fileName,
      url,
      storagePath,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : null,
      sizeBytes: typeof record.sizeBytes === "number" ? record.sizeBytes : null,
      uploadedAt: typeof record.uploadedAt === "string" ? record.uploadedAt : null
    });
  }
  return documents;
}

/** El analisis guarda conclusions como [ { ...HearingConclusions } ]. */
function readConclusions(value: Prisma.JsonValue | null): HearingAnalysisView["conclusions"] {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const conclusions = toHearingConclusions(entry);
  const hasContent = Object.entries(conclusions).some(([key, val]) => key !== "importance" && val.trim().length > 0);
  return hasContent ? conclusions : null;
}

const detailInclude = {
  reform: { select: { id: true, code: true, title: true } },
  hearingRecord: { include: { observedTopics: { orderBy: { createdAt: "asc" } }, documents: { orderBy: { uploadedAt: "asc" } } } },
  analyses: { orderBy: { version: "desc" }, take: 1 },
  normMatches: {
    include: { norm: { select: { code: true, title: true, articleNumber: true } } },
    orderBy: { createdAt: "desc" }
  },
  participants: { orderBy: { displayName: "asc" } },
  insights: { orderBy: { importance: "desc" } },
  transcriptSegments: { orderBy: { startMs: "asc" } },
  mediaFiles: { orderBy: { createdAt: "asc" } },
  actionItems: { orderBy: { createdAt: "asc" } },
  _count: { select: { normMatches: true, participants: true } }
} satisfies Prisma.MeetingInclude;

export async function getHearing(id: string): Promise<HearingDetail | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id, kind: "PUBLIC_HEARING" },
    include: detailInclude
  });
  if (!meeting) return null;

  const analysis = meeting.analyses[0] ?? null;
  const analysisView: HearingAnalysisView | null = analysis
    ? {
        summary: analysis.summary,
        topics: asStringArray(analysis.topics),
        conclusions: readConclusions(analysis.conclusions),
        editedByHuman: analysis.model === "human-review",
        createdAt: analysis.createdAt.toISOString()
      }
    : null;

  const matches: HearingMatchView[] = meeting.normMatches.map((match) => ({
    id: match.id,
    normId: match.projectId,
    code: match.norm.code,
    title: match.norm.title,
    articleNumber: match.norm.articleNumber,
    fragment: match.fragment,
    stance: match.stance,
    confidence: match.confidence,
    atMs: match.atMs,
    createdAt: match.createdAt.toISOString()
  }));

  const participants: HearingParticipantView[] = meeting.participants.map((participant) => ({
    id: participant.id,
    displayName: participant.displayName,
    role: participant.role
  }));

  const insights: HearingInsightView[] = meeting.insights.map((insight) => ({
    id: insight.id,
    kind: insight.kind,
    title: insight.title,
    description: insight.description,
    importance: insight.importance
  }));

  const transcriptSegments: HearingTranscriptSegmentView[] = meeting.transcriptSegments.map((segment) => ({
    id: segment.id,
    speakerLabel: segment.speakerLabel,
    startMs: segment.startMs,
    content: segment.content
  }));

  const mediaFiles: HearingMediaView[] = meeting.mediaFiles.map((media) => ({
    id: media.id,
    fileName: media.fileName,
    kind: media.kind
  }));

  const actionItems: HearingActionItemView[] = meeting.actionItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    assignee: item.assignee,
    status: item.status
  }));

  const metadata =
    meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
      ? (meeting.metadata as Record<string, Prisma.JsonValue>)
      : {};
  const draftTranscript = typeof metadata.draftTranscript === "string" ? metadata.draftTranscript : null;

  // Expediente unificado: el HearingRecord es la fuente de la ficha, las
  // conclusiones y los documentos. metadata queda como fallback de lectura para
  // audiencias previas a la unificacion (o records recien creados vacios).
  const record = meeting.hearingRecord;
  const recordFicha = record ? fichaFromRecord(record) : null;
  const ficha = recordFicha && Object.values(recordFicha).some((value) => value.trim().length > 0)
    ? recordFicha
    : toHearingFicha(metadata.ficha);
  const documents = record?.documents.length ? documentsFromRecord(record.documents) : readDocuments(metadata.documents);
  const recordConclusions = record ? conclusionsFromRecord(record) : null;
  const conclusions = recordConclusions ?? analysisView?.conclusions ?? null;
  const conclusionsByTeam = Boolean(recordConclusions) || (analysisView?.editedByHuman ?? false);

  const resolvedStatus = resolveHearingStatus(meeting.hearingStatus, meeting.status);
  const processing = resolvedStatus === "PROCESSING";
  const ingestError = processing && typeof metadata.error === "string" && metadata.error.trim() ? metadata.error : null;
  const ingestStalled = processing && !ingestError && isIngestStalled(meeting.metadata, meeting.updatedAt);
  // Aviso que sobrevive al cierre: el acta quedo COMPLETED pero recortada.
  const ingestWarning = typeof metadata.ingestWarning === "string" && metadata.ingestWarning.trim() ? metadata.ingestWarning : null;

  return {
    id: meeting.id,
    title: meeting.title,
    occurredAt: meeting.occurredAt ? meeting.occurredAt.toISOString() : null,
    hearingStatus: resolvedStatus,
    location: meeting.location,
    reformId: meeting.reformId,
    reformCode: meeting.reform?.code ?? null,
    reformTitle: meeting.reform?.title ?? null,
    topic: typeof metadata.topic === "string" && metadata.topic.trim().length > 0 ? metadata.topic : null,
    ingestError,
    ingestStalled,
    ingestWarning,
    matchCount: meeting._count.normMatches,
    participantCount: meeting._count.participants,
    description: meeting.description,
    modality: meeting.modality,
    hearingSource: meeting.hearingSource,
    createdAt: meeting.createdAt.toISOString(),
    draftTranscript,
    ficha,
    conclusions,
    conclusionsByTeam,
    analysis: analysisView,
    matches,
    participants,
    insights,
    transcriptSegments,
    mediaFiles,
    documents,
    actionItems
  };
}

export type CreateHearingInput = {
  title: string;
  occurredAt?: Date | null;
  modality?: string | null;
  location?: string | null;
  reformId?: string | null;
  /** Tema libre cuando no hay codigo nuevo asociado. */
  topic?: string | null;
  description?: string | null;
  hearingSource?: HearingSource;
};

export async function createHearing(input: CreateHearingInput): Promise<HearingDetail> {
  const created = await prisma.meeting.create({
    data: {
      title: input.title,
      kind: "PUBLIC_HEARING",
      status: "PENDING",
      hearingStatus: "SCHEDULED",
      hearingSource: input.hearingSource ?? "MANUAL",
      metadata: input.topic ? { topic: input.topic } : {},
      occurredAt: input.occurredAt ?? null,
      modality: input.modality ?? null,
      location: input.location ?? null,
      reformId: input.reformId ?? null,
      description: input.description ?? null,
      // El expediente (HearingRecord) nace con la audiencia: es el unico
      // almacenamiento de la ficha y las conclusiones. El numero de acta lo
      // asigna el equipo despues.
      hearingRecord: {
        create: {
          lifecycle: lifecycleFromStatus("SCHEDULED"),
          mainTopic: input.topic ?? "",
          recordNumber: "",
          recordTitle: input.title
        }
      }
    },
    select: { id: true }
  });

  const detail = await getHearing(created.id);
  if (!detail) throw new Error("No se pudo leer la audiencia recien creada");
  return detail;
}

export type UpdateHearingInput = {
  title?: string;
  occurredAt?: Date | null;
  modality?: string | null;
  location?: string | null;
  reformId?: string | null;
  description?: string | null;
  hearingStatus?: HearingStatus;
};

export async function updateHearing(id: string, input: UpdateHearingInput): Promise<HearingDetail | null> {
  await prisma.meeting.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      ...(input.modality !== undefined ? { modality: input.modality } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.reformId !== undefined ? { reformId: input.reformId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.hearingStatus !== undefined ? { hearingStatus: input.hearingStatus } : {})
    }
  });

  if (input.hearingStatus !== undefined) {
    await syncRecordLifecycle(id, input.hearingStatus);
  }

  return getHearing(id);
}
