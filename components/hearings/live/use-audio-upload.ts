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
  /**
   * Estado de la cola AHORA, sin pasar por el render. El cierre lo necesita
   * porque decide despues de esperar al flush, y para entonces los valores que
   * capturo su closure quedaron viejos (llegaron a mentir "quedaron 0 tramos
   * sin subir" mientras el panel de al lado mostraba 1).
   */
  snapshot: () => UploadQueueState;
  /** Tramos rescatados del navegador de una sesion anterior, para avisarlo. */
  recovered: number;
  /**
   * Todavia se esta leyendo IndexedDB. Hasta que termine no se puede empezar a
   * grabar: el numero del proximo tramo depende de lo que aparezca ahi, y
   * arrancar antes numera la tanda nueva encima de los pendientes.
   */
  recovering: boolean;
};

export function useAudioUpload({
  meetingId,
  alreadyUploaded = 0,
  onRecovered
}: {
  meetingId: string;
  /**
   * Tramos que ya estaban subidos al entrar (audiencia retomada). Cuentan como
   * subidos: si no, el cierre creeria que no se grabo nada y avisaria de mas.
   */
  alreadyUploaded?: number;
  /**
   * Aviso con los tramos rescatados de IndexedDB, ANTES de encolarlos: la
   * pantalla los necesita para que la numeracion de una grabacion nueva
   * arranque DESPUES de ellos. Sin esto se repite la carrera de la IX
   * Audiencia: el server decia "el proximo es el 3" sin saber que habia un
   * tramo 3 pendiente esperando subir.
   */
  onRecovered?: (parts: RecordedPart[]) => void;
}): UseAudioUpload {
  const [state, setState] = useState<UploadQueueState>({ uploaded: alreadyUploaded, pending: 0, stuck: false, error: "" });
  const queueRef = useRef<UploadQueue<RecordedPart> | null>(null);

  /** Firmar → PUT al bucket → registrar el tramo. Tira si algo falla. */
  const uploadPart = useCallback(
    async (part: RecordedPart) => {
      const signResponse = await fetch(`/api/hearings/${meetingId}?action=audio-part-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El nonce viaja para que la ruta del bucket identifique a ESTE tramo:
        // dos tramos distintos con el mismo indice no pueden pisarse.
        body: JSON.stringify({ partIndex: part.index, extension: part.extension, nonce: part.nonce || undefined })
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

      // Confirmado por el servidor: recien ahora se suelta la copia local. Se
      // borra por indice+nonce: la entrada de ESTE tramo, jamas la de otro que
      // comparta numero (tanda vieja vs. nueva).
      await forgetPendingPart(meetingId, part);
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
  const [recovering, setRecovering] = useState(true);
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;
  useEffect(() => {
    let cancelled = false;
    setRecovering(true);
    void listPendingParts(meetingId)
      .then((parts) => {
        if (cancelled || !parts.length) return;
        // Primero se avisa (para correr la numeracion), despues se encola.
        onRecoveredRef.current?.(parts);
        setRecovered(parts.length);
        parts.forEach((part) => queueRef.current?.enqueue(part));
      })
      // Pase lo que pase se habilita a grabar: sin IndexedDB (incognito, cuota
      // llena) listPendingParts no tira, pero dejar el boton trabado por un
      // error inesperado seria peor que grabar sin la red de contencion.
      .finally(() => {
        if (!cancelled) setRecovering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);
  const flush = useCallback(async () => (await queueRef.current?.flush()) ?? true, []);
  const snapshot = useCallback((): UploadQueueState => {
    const queueState = queueRef.current?.state();
    if (!queueState) return { uploaded: alreadyUploaded, pending: 0, stuck: false, error: "" };
    // Mismo criterio que el onChange: lo ya subido antes de entrar cuenta.
    return { ...queueState, uploaded: queueState.uploaded + alreadyUploaded };
  }, [alreadyUploaded]);

  return { ...state, enqueue, flush, recovered, recovering, snapshot };
}
