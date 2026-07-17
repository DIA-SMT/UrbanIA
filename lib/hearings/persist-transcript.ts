import "server-only";

import { MeetingKind, ProcessingStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { parseTranscriptSegments } from "@/lib/hearings/transcript-segments";
import type { SpeakerBinding } from "@/lib/hearings/youtube-transcript";

export type PersistInput = {
  sourceUrl: string;
  title: string;
  durationSec: number;
  costUsd: number;
  truncated: boolean;
  transcript: string;
  speakers: SpeakerBinding[];
};

/**
 * Guarda la transcripcion como Meeting kind=PUBLIC_HEARING con sus
 * TranscriptSegment y MeetingParticipant, al momento de generarla.
 *
 * El motivo es que el artefacto cuesta plata real (~US$0,25): hasta ahora su
 * unico destino era el textarea del navegador de quien lo pidio, y limpiar el
 * historial obligaba a pagar de nuevo. El audio NO se guarda: el video ya vive
 * en el canal del Concejo y los startMs permiten enlazar con &t=NNNs.
 *
 * Se upserta por sourceUrl: volver a transcribir el mismo video reemplaza los
 * segmentos en vez de acumular reuniones duplicadas.
 */
export async function saveHearingTranscript(input: PersistInput): Promise<string> {
  const segments = parseTranscriptSegments(input.transcript);

  // Nombres probados por la pasada 2. El resto de las etiquetas ("Hablante N")
  // no genera participante: seria dar entidad de persona a una voz sin nombre.
  const identified = new Map<string, SpeakerBinding>();
  for (const s of input.speakers) {
    if (s.name) identified.set(s.name, s);
  }

  const metadata = {
    sourceUrl: input.sourceUrl,
    provider: "openrouter-two-pass",
    costUsd: input.costUsd,
    truncated: input.truncated,
    transcribedAt: new Date().toISOString()
  };

  const existing = await prisma.meeting.findFirst({
    where: { metadata: { path: ["sourceUrl"], equals: input.sourceUrl } },
    select: { id: true }
  });

  const meetingId = await prisma.$transaction(async (tx) => {
    let id: string;

    if (existing) {
      id = existing.id;
      await tx.meeting.update({
        where: { id },
        data: { title: input.title, status: ProcessingStatus.READY, metadata }
      });
      // Reemplazo completo: los segmentos y participantes anteriores salieron de
      // una corrida vieja sobre el mismo video, no son datos cargados a mano.
      await tx.transcriptSegment.deleteMany({ where: { meetingId: id } });
      await tx.meetingParticipant.deleteMany({ where: { meetingId: id } });
    } else {
      const created = await tx.meeting.create({
        data: {
          title: input.title,
          kind: MeetingKind.PUBLIC_HEARING,
          status: ProcessingStatus.READY,
          language: "es",
          metadata
        },
        select: { id: true }
      });
      id = created.id;
    }

    const participantIds = new Map<string, string>();
    for (const [name, binding] of identified) {
      const p = await tx.meetingParticipant.create({
        data: {
          meetingId: id,
          displayName: name,
          // La cita que probo la identidad, para que quien firme pueda verificarla.
          metadata: { evidence: binding.evidence ?? null }
        },
        select: { id: true }
      });
      participantIds.set(name, p.id);
    }

    if (segments.length) {
      await tx.transcriptSegment.createMany({
        data: segments.map((s) => ({
          meetingId: id,
          participantId: participantIds.get(s.speakerLabel) ?? null,
          speakerLabel: s.speakerLabel,
          startMs: s.startMs,
          endMs: s.endMs,
          content: s.content
        }))
      });
    }

    return id;
  });

  return meetingId;
}
