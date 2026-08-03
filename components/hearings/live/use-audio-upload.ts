"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { uploadToBucket } from "@/components/shared/upload-to-bucket";
import { forgetPendingPart, listPendingParts, savePendingPart } from "@/components/hearings/live/pending-audio-store";
import type { RecordedPart } from "@/components/hearings/live/use-recorder";
import { UploadQueue, type UploadQueueState } from "@/components/hearings/live/upload-queue";

/**
 * Subida de los tramos de audio de una audiencia en vivo. La logica de cola y
 * reintentos vive en UploadQueue (sin React, con tests); aca solo va lo que
 * necesita el navegador: como sube un tramo y como se refleja en pantalla.
 *
 * Cada tramo pasa por tres pasos: firmar, subir al bucket, registrar. El
 * registro va ULTIMO a proposito: si la subida falla no queda una fila
 * apuntando a un archivo que no existe. Al reves (archivo sin fila) no duele:
 * el borrado de la audiencia limpia la carpeta entera del bucket.
 */

/** Cada cuanto se reintenta lo que quedo trabado. Una audiencia dura horas: hay tiempo. */
const SWEEP_MS = 60_000;

export type UseAudioUpload = UploadQueueState & {
  /** Encola un tramo recien cerrado por la grabadora. */
  enqueue: (part: RecordedPart) => void;
  /** Espera a que la cola quede vacia. False si quedaron tramos sin subir. */
  flush: () => Promise<boolean>;
  /** Tramos rescatados del navegador de una sesion anterior, para avisarlo. */
  recovered: number;
};

export function useAudioUpload({
  meetingId,
  alreadyUploaded = 0
}: {
  meetingId: string;
  /**
   * Tramos que ya estaban subidos al entrar (audiencia retomada). Cuentan como
   * subidos: si no, el cierre creeria que no se grabo nada y avisaria de mas.
   */
  alreadyUploaded?: number;
}): UseAudioUpload {
  const [state, setState] = useState<UploadQueueState>({ uploaded: alreadyUploaded, pending: 0, stuck: false, error: "" });
  const queueRef = useRef<UploadQueue<RecordedPart> | null>(null);

  /** Firmar → PUT al bucket → registrar el tramo. Tira si algo falla. */
  const uploadPart = useCallback(
    async (part: RecordedPart) => {
      const signResponse = await fetch(`/api/hearings/${meetingId}?action=audio-part-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partIndex: part.index, extension: part.extension })
      });
      if (!signResponse.ok) {
        const payload = await signResponse.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || `No se pudo preparar la subida (${signResponse.status}).`);
      }
      const { signedUrl, storagePath } = (await signResponse.json()) as { signedUrl: string; storagePath: string };

      // Se reusa la subida directa del proyecto (la misma de documentos y
      // normas). El progreso no se usa: un tramo pesa ~1,2 MB y nadie lo mira.
      const fileName = storagePath.split("/").pop() ?? `part-${part.index}.${part.extension}`;
      await uploadToBucket(signedUrl, new File([part.blob], fileName, { type: part.mimeType }), () => {});

      const confirmResponse = await fetch(`/api/hearings/${meetingId}?action=audio-part`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          partIndex: part.index,
          mimeType: part.mimeType,
          sizeBytes: part.blob.size,
          offsetMs: part.offsetMs,
          durationMs: part.durationMs
        })
      });
      if (!confirmResponse.ok) {
        const payload = await confirmResponse.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || `No se pudo registrar el tramo (${confirmResponse.status}).`);
      }

      // Confirmado por el servidor: recien ahora se suelta la copia local.
      await forgetPendingPart(meetingId, part.index);
    },
    [meetingId]
  );

  // La cola se crea una sola vez: sobrevive a los re-renders de la sesion.
  const uploadRef = useRef(uploadPart);
  uploadRef.current = uploadPart;
  if (!queueRef.current) {
    queueRef.current = new UploadQueue<RecordedPart>({
      upload: (part) => uploadRef.current(part),
      // Lo ya subido se suma al contador de la cola, que arranca en cero.
      onChange: (queueState) => setState({ ...queueState, uploaded: queueState.uploaded + alreadyUploaded })
    });
  }

  // Barrido: destraba lo que agoto reintentos y vuelve a probar. Cubre el caso
  // tipico de una audiencia real: se cae el wifi de la sala un rato y vuelve.
  useEffect(() => {
    const interval = setInterval(() => {
      const queue = queueRef.current;
      if (!queue || queue.state().pending === 0) return;
      queue.retryStuck();
      void queue.drain();
    }, SWEEP_MS);
    return () => clearInterval(interval);
  }, []);

  const enqueue = useCallback(
    (part: RecordedPart) => {
      // Copia local ANTES de intentar subir: si se corta todo justo ahora, el
      // tramo sobrevive al cierre del navegador y se recupera al volver.
      void savePendingPart(meetingId, part);
      queueRef.current?.enqueue(part);
    },
    [meetingId]
  );

  // Recuperacion: tramos que quedaron guardados de una sesion anterior (se
  // cerro el navegador con la subida a medias). Se reencolan al entrar.
  const [recovered, setRecovered] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void listPendingParts(meetingId).then((parts) => {
      if (cancelled || !parts.length) return;
      setRecovered(parts.length);
      parts.forEach((part) => queueRef.current?.enqueue(part));
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);
  const flush = useCallback(async () => (await queueRef.current?.flush()) ?? true, []);

  return { ...state, enqueue, flush, recovered };
}
