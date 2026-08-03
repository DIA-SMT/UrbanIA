"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Grabacion de la audiencia con MediaRecorder, cortada en TRAMOS
 * independientes. Reemplaza al dictado con la Web Speech API: ahora la
 * transcripcion no sale del navegador sino de Whisper, despues, sobre este
 * audio.
 *
 * Por que en tramos y no un archivo unico:
 * - Cada tramo se sube apenas se cierra. Si el navegador muere a las dos horas
 *   se pierde el ultimo tramo, no la audiencia entera. En una audiencia publica
 *   no hay segunda toma: es la decision mas importante de este archivo.
 * - Cada tramo entra solo en una llamada a Whisper (~1,2 MB contra el limite de
 *   25 MB), asi que NO hay que partirlo con ffmpeg del lado del servidor. Eso
 *   es lo que permite que la transcripcion corra en una funcion de Vercel.
 *
 * Por que los tramos se SOLAPAN: entre parar un grabador y arrancar el
 * siguiente hay un hueco donde nadie escucha. Aca se arranca el siguiente ANTES
 * de parar el anterior, asi que el borde queda duplicado en vez de perdido.
 * Repetir media palabra no le hace nada a Whisper; perderla, si.
 *
 * OJO: dos MediaRecorder sobre el mismo stream a la vez es legal pero poco
 * transitado. Si el navegador lo rechaza se cae al metodo simple (parar y
 * arrancar), que deja un hueco de milisegundos en vez de romper la grabacion.
 */

/** Formatos que puede emitir MediaRecorder, en orden de preferencia. Whisper acepta los cuatro. */
const FORMATS: Array<{ mimeType: string; extension: string }> = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "mp4" }
];

/** Voz hablada en opus: 32 kbps mono alcanza y sobra (~14 MB por hora). */
const BITS_PER_SECOND = 32_000;
/** Duracion objetivo de cada tramo. Mas corto = se pierde menos si algo falla; mas largo = menos objetos. */
const PART_MS = 5 * 60 * 1000;
/** Cuanto sigue grabando el tramo viejo despues de que arranco el nuevo. */
const OVERLAP_MS = 300;
/** Cada cuanto se recalcula el nivel de entrada del microfono. */
const LEVEL_INTERVAL_MS = 150;

export type RecordedPart = {
  /** Correlativo desde 0. Define el nombre en el bucket y el orden. */
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  /** Milisegundos desde el inicio de la grabacion hasta el inicio de ESTE tramo. */
  offsetMs: number;
  durationMs: number;
};

type WakeLockSentinelLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/** El formato soportado de mayor preferencia, o null si no hay ninguno. */
function pickFormat(): { mimeType: string; extension: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  return FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
}

export type UseRecorder = {
  /** El navegador puede grabar (hay MediaRecorder y algun formato servible). */
  supported: boolean;
  recording: boolean;
  /** Pidiendo permiso del microfono: entre el click y el primer byte. */
  starting: boolean;
  error: string;
  /**
   * Nivel de entrada 0..1, en un ref y NO en estado: se actualiza ~7 veces por
   * segundo y meterlo en estado re-renderizaria la pantalla entera todo el
   * tiempo. El medidor lo lee con su propio intervalo.
   */
  level: React.MutableRefObject<number>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function useRecorder({ onPart }: { onPart: (part: RecordedPart) => void }): UseRecorder {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const level = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partIndexRef = useRef(0);
  const startedAtRef = useRef(0);
  const formatRef = useRef<{ mimeType: string; extension: string } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  // onPart en un ref: el intervalo de rotacion se arma una vez y no tiene que
  // reconstruirse porque el componente re-renderice con otro callback.
  const onPartRef = useRef(onPart);
  onPartRef.current = onPart;

  // isTypeSupported no existe en el server: la deteccion va despues del montaje.
  useEffect(() => {
    formatRef.current = pickFormat();
    setSupported(Boolean(formatRef.current && navigator.mediaDevices?.getUserMedia));
  }, []);

  /**
   * Arranca un grabador para UN tramo. Al pararlo emite su blob por onPart.
   * El offset se calcula al arrancar, no al cerrar: es el momento real en que
   * ese audio empezo, y es lo que despues alinea los timestamps de Whisper.
   */
  const startPart = useCallback((stream: MediaStream, index: number): MediaRecorder | null => {
    const format = formatRef.current;
    if (!format) return null;

    const offsetMs = Math.max(0, Date.now() - startedAtRef.current);
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: BITS_PER_SECOND });
    } catch {
      return null;
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: format.mimeType });
      if (!blob.size) return;
      onPartRef.current({
        index,
        blob,
        mimeType: format.mimeType,
        extension: format.extension,
        offsetMs,
        durationMs: Math.max(0, Date.now() - startedAtRef.current - offsetMs)
      });
    };
    recorder.start();
    return recorder;
  }, []);

  /** Cierra el tramo vigente y abre el siguiente, solapados. */
  const rotate = useCallback(() => {
    const stream = streamRef.current;
    const previous = recorderRef.current;
    if (!stream) return;

    const next = startPart(stream, partIndexRef.current + 1);
    if (next) {
      // Camino bueno: el nuevo ya esta grabando, el viejo cierra en un rato.
      partIndexRef.current += 1;
      recorderRef.current = next;
      setTimeout(() => {
        if (previous?.state === "recording") previous.stop();
      }, OVERLAP_MS);
      return;
    }

    // El navegador no acepto dos grabadores a la vez: parar y arrancar. Queda
    // un hueco de milisegundos, mucho mejor que quedarse sin grabar.
    if (previous?.state === "recording") previous.stop();
    partIndexRef.current += 1;
    recorderRef.current = startPart(stream, partIndexRef.current);
  }, [startPart]);

  /** Pide que la pantalla no se apague: si la maquina se suspende, la grabacion muere. */
  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock) return;
    try {
      wakeLockRef.current = await wakeLock.request("screen");
    } catch {
      // Sin bloqueo de pantalla se graba igual; es una red de contencion.
    }
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current || starting) return;
    const format = formatRef.current;
    if (!format) {
      setError("Este navegador no puede grabar audio. Usá Chrome o Edge actualizados.");
      return;
    }

    setStarting(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Mono y sin los filtros pensados para llamadas: una audiencia es una
        // sala con voces lejanas, y la supresion de ruido se come palabras. El
        // control de ganancia si ayuda con quien habla bajo.
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true }
      });
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      partIndexRef.current = 0;

      const first = startPart(stream, 0);
      if (!first) throw new Error("No se pudo iniciar la grabación.");
      recorderRef.current = first;

      rotationRef.current = setInterval(rotate, PART_MS);

      // Medidor de nivel: que el operador VEA que esta entrando audio. Grabar
      // dos horas de silencio por un micro mal elegido es el peor final posible.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      levelTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        level.current = Math.min(1, Math.sqrt(sum / samples.length) * 3);
      }, LEVEL_INTERVAL_MS);

      await requestWakeLock();
      setRecording(true);
    } catch (startError) {
      const message =
        startError instanceof DOMException && (startError.name === "NotAllowedError" || startError.name === "SecurityError")
          ? "No diste permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones y volvé a intentar."
          : startError instanceof DOMException && startError.name === "NotFoundError"
            ? "No se encontró ningún micrófono conectado."
            : startError instanceof Error
              ? startError.message
              : "No se pudo acceder al micrófono.";
      setError(message);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } finally {
      setStarting(false);
    }
  }, [requestWakeLock, rotate, startPart, starting]);

  /**
   * Corta la grabacion y espera a que el ULTIMO tramo salga por onPart: quien
   * llama (finalizar la audiencia) necesita que el audio este completo antes de
   * seguir, si no se cierra la audiencia sin su ultimo tramo.
   */
  const stop = useCallback(async () => {
    if (rotationRef.current) {
      clearInterval(rotationRef.current);
      rotationRef.current = null;
    }
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    level.current = 0;

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const previousOnStop = recorder.onstop;
        recorder.onstop = (event) => {
          previousOnStop?.call(recorder, event);
          resolve();
        };
        recorder.stop();
      });
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    await audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    await wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setRecording(false);
  }, []);

  // El bloqueo de pantalla se suelta solo cuando la pestana pasa a segundo
  // plano: al volver hay que pedirlo de nuevo o la maquina se suspende igual.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && recorderRef.current) void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  // Al desmontar se sueltan el microfono y el bloqueo de pantalla. No se espera
  // el ultimo tramo: si se llego aca sin parar, la pantalla ya se esta yendo.
  useEffect(
    () => () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close().catch(() => {});
      void wakeLockRef.current?.release().catch(() => {});
    },
    []
  );

  return { supported, recording, starting, error, level, start, stop };
}
