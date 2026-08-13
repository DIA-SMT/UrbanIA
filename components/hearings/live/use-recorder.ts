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
  /**
   * Identificador unico de ESTE tramo, para que la copia local en IndexedDB
   * tenga clave propia: dos tramos que compartan indice (paso en la IX
   * Audiencia, 2026-08-12) no pueden pisarse ni borrarse entre si.
   */
  nonce: string;
};

/** Donde tiene que continuar la grabacion: proximo indice libre y fin de lo ya grabado. */
export type ResumePoint = {
  index: number;
  offsetMs: number;
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

export function useRecorder({
  onPart,
  nextPart
}: {
  onPart: (part: RecordedPart) => void;
  /**
   * Punto de reanudacion EXTERNO: proximo indice libre y fin de lo ya grabado,
   * contando los tramos subidos al server Y los pendientes recuperados de
   * IndexedDB. Es una funcion y no un valor porque la recuperacion es
   * asincronica: el numero correcto puede llegar despues del primer render.
   *
   * La grabadora ademas lleva SU PROPIO maximo y usa el mayor de los dos: asi
   * "Reanudar" en la misma pantalla jamas repite un indice ni un rango de
   * tiempo, que es exactamente lo que trabo la subida en la IX Audiencia
   * (2026-08-12): reanudar renumeraba desde 0 y todo chocaba en el bucket.
   */
  nextPart?: () => ResumePoint;
}): UseRecorder {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const level = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Proximo indice SIN usar. Solo crece: un indice consumido no se reusa ni aunque su tramo falle. */
  const nextIndexRef = useRef(0);
  /** Fin de lo grabado por ESTA pantalla (offset absoluto). Base de los tiempos al reanudar. */
  const timelineEndMsRef = useRef(0);
  /** Grabadores que todavia no emitieron su tramo (incluye el solapado por la rotacion). */
  const partsInFlightRef = useRef(new Map<MediaRecorder, Promise<void>>());
  /**
   * Cambia con cada stop(). start() la mira despues de cada await: si cambio,
   * es que pararon (o se fueron de la pantalla) mientras el navegador pedia el
   * microfono, y hay que soltar todo en vez de arrancar una grabacion que ya
   * nadie ve ni puede detener.
   */
  const generationRef = useRef(0);
  /**
   * stop() por referencia: lo necesita el listener de "se murio el microfono",
   * que se registra dentro de start() y no puede depender de la identidad de
   * stop (se asigna mas abajo, apenas stop existe).
   */
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  /** Offset absoluto donde arranco la sesion de grabacion vigente. */
  const sessionBaseMsRef = useRef(0);
  const startedAtRef = useRef(0);
  const formatRef = useRef<{ mimeType: string; extension: string } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  // onPart y nextPart en refs: el intervalo de rotacion se arma una vez y no
  // tiene que reconstruirse porque el componente re-renderice con otro callback.
  const onPartRef = useRef(onPart);
  onPartRef.current = onPart;
  const nextPartRef = useRef(nextPart);
  nextPartRef.current = nextPart;

  // isTypeSupported no existe en el server: la deteccion va despues del montaje.
  useEffect(() => {
    formatRef.current = pickFormat();
    setSupported(Boolean(formatRef.current && navigator.mediaDevices?.getUserMedia));
  }, []);

  /**
   * Arranca un grabador para UN tramo. Al pararlo emite su blob por onPart.
   * El offset se calcula al arrancar, no al cerrar: es el momento real en que
   * ese audio empezo, y es lo que despues alinea los timestamps de Whisper.
   *
   * El indice se CONSUME aca adentro y no se devuelve nunca al pozo: si el
   * grabador no llega a nacer queda un hueco en la numeracion, que no molesta
   * (los tramos se ordenan por indice, no hace falta que sean contiguos).
   * Reusar un indice si molesta: chocaria en el bucket con el que lo estreno.
   */
  const startPart = useCallback((stream: MediaStream): MediaRecorder | null => {
    const format = formatRef.current;
    if (!format) return null;

    const index = nextIndexRef.current;
    nextIndexRef.current = index + 1;
    const partStartedAtMs = Date.now();
    // El offset continua la linea de tiempo global: sesiones anteriores de esta
    // pantalla, tramos ya subidos y pendientes recuperados incluidos.
    const offsetMs = sessionBaseMsRef.current + Math.max(0, partStartedAtMs - startedAtRef.current);
    const nonce = Math.random().toString(36).slice(2, 10);
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: BITS_PER_SECOND });
      // start() adentro del try: con el stream muerto (micro desconectado) el
      // constructor pasa igual y la excepcion sale recien aca. Afuera, esa
      // excepcion escapaba del setInterval de rotacion y dejaba la pantalla
      // diciendo "Grabando" con el micro apagado.
      recorder.start();
    } catch {
      return null;
    }

    // Un tramo cerrado se resuelve aca: stop() espera a TODOS los que sigan
    // vivos, incluido el que quedo solapado por la rotacion, antes de dar por
    // terminada la grabacion. Si no, ese tramo (hasta 5 minutos) se encolaba
    // despues de que el cierre ya habia dado todo por subido.
    let settle = () => {};
    partsInFlightRef.current.set(
      recorder,
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );
    const finish = () => {
      partsInFlightRef.current.delete(recorder);
      settle();
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = finish;
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: format.mimeType });
        if (blob.size) {
          onPartRef.current({
            index,
            blob,
            mimeType: format.mimeType,
            extension: format.extension,
            offsetMs,
            durationMs: Math.max(0, Date.now() - partStartedAtMs),
            nonce
          });
        }
      } finally {
        finish();
      }
    };
    return recorder;
  }, []);

  /** Cierra el tramo vigente y abre el siguiente, solapados. */
  const rotate = useCallback(() => {
    const stream = streamRef.current;
    const previous = recorderRef.current;
    if (!stream) return;

    const next = startPart(stream);
    if (next) {
      // Camino bueno: el nuevo ya esta grabando, el viejo cierra en un rato.
      recorderRef.current = next;
      setTimeout(() => {
        if (previous?.state === "recording") previous.stop();
      }, OVERLAP_MS);
      return;
    }

    // El navegador no acepto dos grabadores a la vez: parar y arrancar. Queda
    // un hueco de milisegundos, mucho mejor que quedarse sin grabar.
    if (previous?.state === "recording") previous.stop();
    recorderRef.current = startPart(stream);
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
    const generation = generationRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Mono y sin los filtros pensados para llamadas: una audiencia es una
        // sala con voces lejanas, y la supresion de ruido se come palabras. El
        // control de ganancia si ayuda con quien habla bajo.
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true }
      });

      // Pararon (o cerraron la audiencia) mientras el navegador preguntaba por
      // el microfono: se suelta y no se arranca nada. Sin esto quedaba una
      // grabacion viva que ninguna pantalla mostraba ni podia detener, subiendo
      // tramos a una audiencia ya cerrada.
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      startedAtRef.current = Date.now();

      // El micro se puede ir en cualquier momento (USB desenchufado, Bluetooth
      // dormido). Sin esto la pantalla seguia diciendo "Grabando" con el
      // cronometro corriendo y nadie grababa.
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => {
          if (generation !== generationRef.current) return;
          setError("Se desconectó el micrófono y la grabación se detuvo. Revisá el cable o el Bluetooth y apretá «Reanudar grabación».");
          void stopRef.current?.();
        });
      }

      // Punto de reanudacion: el mayor entre lo que sabe la pantalla (tramos
      // del server + pendientes recuperados) y lo que esta grabadora ya emitio.
      // Nunca hacia atras: reusar un indice o un rango de tiempo pisa audio.
      const resume = nextPartRef.current?.() ?? { index: 0, offsetMs: 0 };
      nextIndexRef.current = Math.max(resume.index, nextIndexRef.current);
      sessionBaseMsRef.current = Math.max(resume.offsetMs, timelineEndMsRef.current);

      const first = startPart(stream);
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
      if (generation !== generationRef.current) return;
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
   * Corta la grabacion y espera a que TODOS los tramos vivos salgan por onPart:
   * quien llama (finalizar la audiencia) necesita que el audio este completo
   * antes de seguir, si no se cierra la audiencia sin su ultimo tramo. "Todos"
   * y no "el ultimo" por la rotacion solapada: durante 300ms hay dos grabadores
   * abiertos, y el que quedaba atras podia encolar sus 5 minutos DESPUES de que
   * el cierre ya habia dado todo por subido.
   */
  const stop = useCallback(async () => {
    // Invalida cualquier start() que este esperando el permiso del microfono.
    generationRef.current += 1;

    if (rotationRef.current) {
      clearInterval(rotationRef.current);
      rotationRef.current = null;
    }
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    level.current = 0;

    // Fin de lo grabado hasta aca: si el operador reanuda, los tiempos del
    // proximo tramo continuan desde este punto en vez de volver a empezar.
    if (streamRef.current) {
      timelineEndMsRef.current = sessionBaseMsRef.current + Math.max(0, Date.now() - startedAtRef.current);
    }

    recorderRef.current = null;
    // Se paran todos los grabadores abiertos y se espera a que cada uno emita.
    const inFlight = [...partsInFlightRef.current.entries()];
    for (const [recorder] of inFlight) {
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Ya estaba muriendo: su promesa igual se resuelve por onstop/onerror.
        }
      }
    }
    await Promise.all(inFlight.map(([, done]) => done));

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    await audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    await wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setRecording(false);
  }, []);

  stopRef.current = stop;

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
      // Invalida un start() que este esperando el permiso: si el operador da
      // "Permitir" cuando la pantalla ya no existe, no queda un microfono
      // abierto grabando sin nadie que pueda detenerlo.
      generationRef.current += 1;
      if (rotationRef.current) clearInterval(rotationRef.current);
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
      for (const [recorder] of partsInFlightRef.current) {
        if (recorder.state === "recording") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close().catch(() => {});
      void wakeLockRef.current?.release().catch(() => {});
    },
    []
  );

  return { supported, recording, starting, error, level, start, stop };
}
