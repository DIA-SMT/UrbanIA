// Capa de unificacion del expediente de audiencias: HearingRecord (el modelo
// relacional de la rama de Agustin) es el UNICO almacenamiento de la Ficha 1
// (datos) y la Ficha 2 (conclusiones). Este modulo traduce entre los tipos
// planos que usa la UI (HearingFicha / HearingConclusions) y las columnas del
// record. Meeting.metadata.ficha queda solo como fallback de lectura para
// audiencias previas a la unificacion.
//
// Sin "server-only" a proposito: lo comparten las rutas y la ingesta batch
// (worker CLI via tsx), mismo criterio que batch-match.ts.

import {
  HearingLifecycle,
  HearingProposalOrigin,
  TopicImportance,
  type HearingStatus,
  type HearingDocument,
  type HearingObservedTopic,
  type HearingRecord
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toHearingFicha } from "@/lib/hearings/shared";
import type { HearingConclusions, HearingDocumentView, HearingFicha } from "@/lib/hearings/shared";

/* ------------------------------ Conversiones ------------------------------ */

/** "a, b, c" -> ["a","b","c"]. */
function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(value: string[]): string {
  return value.join(", ");
}

/**
 * El estado del registro (Meeting.hearingStatus, el que usa toda la UI) se
 * espeja en el ciclo de vida del acta para que el record quede coherente.
 */
export function lifecycleFromStatus(status: HearingStatus): HearingLifecycle {
  switch (status) {
    case "SCHEDULED":
      return HearingLifecycle.PROGRAMADA;
    case "LIVE":
    case "PROCESSING":
      return HearingLifecycle.EN_CURSO;
    case "COMPLETED":
      return HearingLifecycle.FINALIZADA;
    case "CANCELLED":
      return HearingLifecycle.SUSPENDIDA;
  }
}

/**
 * El enum del record es mas grueso que las etiquetas de la ficha: solo se pisa
 * cuando el mapeo es inequivoco; si no, se conserva el valor que tenga. La
 * etiqueta exacta vive siempre en la columna proposalSource.
 */
function proposalOriginFromLabel(label: string): HearingProposalOrigin | null {
  if (label === "Concejo") return HearingProposalOrigin.CONCEJO;
  if (label === "Vecinal / Ciudadana") return HearingProposalOrigin.CIUDADANIA;
  if (label === "Área técnica") return HearingProposalOrigin.CODIGO_URBANO;
  return null;
}

const IMPORTANCE_TO_ENUM: Record<string, TopicImportance> = {
  Bajo: TopicImportance.BAJO,
  Medio: TopicImportance.MEDIO,
  Alto: TopicImportance.ALTO,
  "Crítico": TopicImportance.CRITICO,
  Critico: TopicImportance.CRITICO
};

const IMPORTANCE_FROM_ENUM: Record<TopicImportance, string> = {
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
  CRITICO: "Crítico"
};

/* -------------------------------- Lectura --------------------------------- */

export type HearingRecordWithChildren = HearingRecord & {
  observedTopics: HearingObservedTopic[];
  documents: HearingDocument[];
};

/** Ficha 1 plana (la que edita la UI) desde las columnas del record. */
export function fichaFromRecord(record: HearingRecord): HearingFicha {
  return {
    mainTopic: record.mainTopic,
    secondaryTopics: listToCsv(record.secondaryTopics),
    relatedProposal: record.relatedProposal ?? "",
    proposalSource: record.proposalSource ?? "",
    author: record.promotingArea ?? "",
    relatedArticles: listToCsv(record.relatedArticles),
    participants: record.participantsText ?? "",
    institution: record.institution ?? "",
    role: record.participantRole ?? "",
    actorType: record.actorType ?? "",
    intervention: record.intervention ?? ""
  };
}

/** Ficha 2 plana desde el record. null si el acta no tiene conclusiones aun. */
export function conclusionsFromRecord(record: HearingRecordWithChildren): HearingConclusions | null {
  const topics = record.observedTopics;
  const conclusions: HearingConclusions = {
    summary: record.conclusionsSummary ?? "",
    agreements: record.agreements ?? "",
    disagreements: record.disagreements ?? "",
    nextSteps: record.nextSteps ?? "",
    technicalRecommendations: record.technicalRecommendations ?? "",
    decisions: record.decisions ?? "",
    proposalStatusAfter: record.proposalStatusAfter ?? "",
    observedTopics: listToCsv(topics.map((topic) => topic.topic)),
    // La columna manda; las filas son el respaldo para actas previas a que
    // existiera (y "Medio" el ultimo recurso).
    importance: record.topicsImportance
      ? IMPORTANCE_FROM_ENUM[record.topicsImportance]
      : topics.length
        ? IMPORTANCE_FROM_ENUM[topics[0].importance]
        : "Medio",
    technicalObservation: record.technicalObservation ?? "",
    citizenObservation: record.citizenObservation ?? ""
  };

  const hasContent = Object.entries(conclusions).some(([key, value]) => key !== "importance" && value.trim().length > 0);
  return hasContent ? conclusions : null;
}

/** Documentos adjuntos (Supabase Storage) desde las filas del record. */
export function documentsFromRecord(documents: HearingDocument[]): HearingDocumentView[] {
  return documents
    .filter((doc) => doc.url)
    .map((doc) => ({
      id: doc.id,
      fileName: doc.name,
      url: doc.url as string,
      storagePath: doc.storagePath ?? "",
      mimeType: doc.type || null,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt.toISOString()
    }));
}

/* -------------------------------- Escritura ------------------------------- */

/**
 * Garantiza que la audiencia tenga su HearingRecord (las previas a la
 * unificacion no lo traen) y devuelve su id. El titulo del acta nace del
 * titulo de la reunion; el numero de expediente queda vacio hasta que el
 * equipo lo asigne.
 */
export async function ensureHearingRecord(meetingId: string): Promise<string> {
  const existing = await prisma.hearingRecord.findUnique({ where: { meetingId }, select: { id: true } });
  if (existing) return existing.id;

  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    select: { title: true, hearingStatus: true, metadata: true }
  });

  // Tema libre guardado al crear la audiencia, si lo hay.
  const metadata = meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
    ? (meeting.metadata as Record<string, unknown>)
    : {};
  const topic = typeof metadata.topic === "string" ? metadata.topic : "";

  // Ficha legacy (metadata.ficha) de audiencias previas a la unificacion: se
  // siembra al crear el expediente, asi el record queda como unica fuente y la
  // lectura no necesita volver a mirar metadata nunca mas.
  const legacy = toHearingFicha(metadata.ficha);
  const hasLegacy = Object.values(legacy).some((value) => value.trim().length > 0);

  const created = await prisma.hearingRecord.create({
    data: {
      meetingId,
      lifecycle: lifecycleFromStatus(meeting.hearingStatus ?? "SCHEDULED"),
      mainTopic: legacy.mainTopic || topic,
      recordNumber: "",
      recordTitle: meeting.title,
      ...(hasLegacy
        ? {
            secondaryTopics: csvToList(legacy.secondaryTopics),
            relatedProposal: legacy.relatedProposal || null,
            proposalSource: legacy.proposalSource || null,
            promotingArea: legacy.author || null,
            relatedArticles: csvToList(legacy.relatedArticles),
            participantsText: legacy.participants || null,
            institution: legacy.institution || null,
            participantRole: legacy.role || null,
            actorType: legacy.actorType || null,
            intervention: legacy.intervention || null
          }
        : {})
    },
    select: { id: true }
  });
  return created.id;
}

/** Persiste la Ficha 1 en el record (merge: solo pisa los campos presentes). */
export async function saveRecordFicha(meetingId: string, ficha: Partial<HearingFicha>): Promise<void> {
  const recordId = await ensureHearingRecord(meetingId);

  const origin = ficha.proposalSource !== undefined ? proposalOriginFromLabel(ficha.proposalSource) : null;

  await prisma.hearingRecord.update({
    where: { id: recordId },
    data: {
      ...(ficha.mainTopic !== undefined ? { mainTopic: ficha.mainTopic } : {}),
      ...(ficha.secondaryTopics !== undefined ? { secondaryTopics: csvToList(ficha.secondaryTopics) } : {}),
      ...(ficha.relatedProposal !== undefined ? { relatedProposal: ficha.relatedProposal || null } : {}),
      ...(ficha.proposalSource !== undefined ? { proposalSource: ficha.proposalSource || null } : {}),
      ...(origin ? { proposalOrigin: origin } : {}),
      ...(ficha.author !== undefined ? { promotingArea: ficha.author || null } : {}),
      ...(ficha.relatedArticles !== undefined ? { relatedArticles: csvToList(ficha.relatedArticles) } : {}),
      ...(ficha.participants !== undefined ? { participantsText: ficha.participants || null } : {}),
      ...(ficha.institution !== undefined ? { institution: ficha.institution || null } : {}),
      ...(ficha.role !== undefined ? { participantRole: ficha.role || null } : {}),
      ...(ficha.actorType !== undefined ? { actorType: ficha.actorType || null } : {}),
      ...(ficha.intervention !== undefined ? { intervention: ficha.intervention || null } : {})
    }
  });
}

/**
 * Persiste la Ficha 2 en el record: columnas propias + una fila de
 * HearingObservedTopic por tema (comparten la importancia elegida). Es el
 * almacenamiento firmado por una persona: re-correr la IA no lo toca.
 */
export async function saveRecordConclusions(meetingId: string, conclusions: HearingConclusions): Promise<void> {
  const recordId = await ensureHearingRecord(meetingId);
  const importance = IMPORTANCE_TO_ENUM[conclusions.importance] ?? TopicImportance.MEDIO;

  await prisma.$transaction([
    prisma.hearingRecord.update({
      where: { id: recordId },
      data: {
        conclusionsSummary: conclusions.summary || null,
        agreements: conclusions.agreements || null,
        disagreements: conclusions.disagreements || null,
        nextSteps: conclusions.nextSteps || null,
        technicalRecommendations: conclusions.technicalRecommendations || null,
        decisions: conclusions.decisions || null,
        proposalStatusAfter: conclusions.proposalStatusAfter || null,
        technicalObservation: conclusions.technicalObservation || null,
        citizenObservation: conclusions.citizenObservation || null,
        // En columna propia: sin temas cargados, las filas de abajo no existen
        // y la importancia elegida se perdia.
        topicsImportance: importance
      }
    }),
    prisma.hearingObservedTopic.deleteMany({ where: { hearingRecordId: recordId } }),
    prisma.hearingObservedTopic.createMany({
      data: csvToList(conclusions.observedTopics).map((topic) => ({
        hearingRecordId: recordId,
        topic,
        description: "",
        importance
      }))
    })
  ]);
}

/** Espeja el estado de la UI en el ciclo de vida del acta, si el record existe. */
export async function syncRecordLifecycle(meetingId: string, status: HearingStatus): Promise<void> {
  await prisma.hearingRecord.updateMany({
    where: { meetingId },
    data: { lifecycle: lifecycleFromStatus(status) }
  });
}
