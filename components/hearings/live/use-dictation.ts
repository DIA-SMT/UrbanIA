"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictado en vivo con la Web Speech API del navegador (Chrome/Edge). La API
 * corta sola tras silencios: se reinicia automaticamente mientras la grabacion
 * siga activa. Tipos minimos propios: la API no esta en los tipos estandar del
 * DOM en todos los setups.
 *
 * Robustez (bugs de "toma del microfono"):
 * - Una sola instancia vigente: al relanzar se desmontan los handlers de la
 *   anterior para que su onend no reinicie en paralelo (dos capturas del mic).
 * - El reinicio va con un pequeno delay y reintenta si start() tira: nunca
 *   queda "grabando" en la UI sin escuchar de verdad.
 * - start() es idempotente (evita doble arranque por StrictMode o toggles).
 */

type MinimalSpeechAlternative = { transcript: string; confidence?: number };
type MinimalSpeechResult = { isFinal: boolean; 0: MinimalSpeechAlternative };
type MinimalSpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<MinimalSpeechResult> };

type MinimalSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidates = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidates.SpeechRecognition ?? candidates.webkitSpeechRecognition ?? null;
}

// Ventana muerta del reinicio: entre que el reconocimiento corta y vuelve a
// escuchar, lo hablado NO lo oye nadie. Lo mas corto posible sin que Chrome
// tire por arrancar demasiado rapido (y si tira, launch() reintenta igual).
const RESTART_DELAY_MS = 150;

export type RecognizedFinal = { text: string; confidence: number | null };

/**
 * Procesa un evento onresult COMPLETO (todos los resultados, no solo desde
 * resultIndex) y devuelve las frases finales nuevas y el interino vigente.
 *
 * Por que el barrido completo: Chrome puede tener VARIOS resultados
 * provisorios pendientes a la vez, y resultIndex apunta solo al primero que
 * cambio en este evento. Leyendo desde ahi, un interino anterior que seguia
 * pendiente quedaba fuera del rescate (flushInterim) y se PERDIA si el
 * reconocimiento cortaba. `emittedFinals` (por instancia) evita re-emitir los
 * finales ya entregados.
 */
export function processRecognitionResults(
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }>,
  emittedFinals: Set<number>
): { finals: RecognizedFinal[]; interim: string } {
  const finals: RecognizedFinal[] = [];
  let interim = "";
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result[0]?.transcript ?? "";
    if (result.isFinal) {
      if (emittedFinals.has(index)) continue;
      emittedFinals.add(index);
      const text = transcript.trim();
      if (!text) continue;
      const confidence = result[0]?.confidence;
      // 0 o undefined = el navegador no midio: desconocida, no dudosa.
      finals.push({ text, confidence: typeof confidence === "number" && confidence > 0 ? confidence : null });
    } else {
      interim += transcript;
    }
  }
  return { finals, interim };
}

/**
 * onFinalText recibe cada frase final con su confianza (0..1) o null si el
 * navegador no la informa. La API da confianza POR FRASE, no por palabra: la
 * revision de "dudosas" trabaja a ese nivel.
 */
export function useDictation({ onFinalText }: { onFinalText: (text: string, confidence: number | null) => void }) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchRef = useRef<() => void>(() => {});
  // Ultimo texto interino de la instancia vigente: si el reconocimiento corta
  // antes de finalizarlo, se promueve a frase para NO PERDER lo dicho.
  const interimRef = useRef("");

  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  /**
   * Promueve el interino pendiente a frase final (confianza desconocida ->
   * queda marcada para revisar). Antes ese texto se descartaba en cada corte
   * por silencio y el operador lo vivia como "el dictado me borro palabras".
   */
  const flushInterim = useCallback(() => {
    const leftover = interimRef.current.trim();
    interimRef.current = "";
    if (leftover) onFinalRef.current(`${leftover} `, null);
  }, []);

  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  /** Desmonta la instancia vigente para que sus callbacks no reinicien nada. */
  const teardownCurrent = useCallback(() => {
    const previous = recognitionRef.current;
    if (!previous) return;
    previous.onstart = null;
    previous.onresult = null;
    previous.onend = null;
    previous.onerror = null;
    try {
      previous.abort();
    } catch {
      // Ya estaba detenida.
    }
    recognitionRef.current = null;
  }, []);

  const scheduleRestart = useCallback(() => {
    if (restartTimerRef.current) return;
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (activeRef.current) launchRef.current();
    }, RESTART_DELAY_MS);
  }, []);

  const launch = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSupported(false);
      return;
    }

    // Tumba cualquier instancia previa antes de crear la nueva (salvando su
    // interino, si lo tuviera).
    flushInterim();
    teardownCurrent();

    const recognition = new Recognition();
    recognition.lang = "es-AR";
    recognition.continuous = true;
    recognition.interimResults = true;

    // Finales ya emitidos de ESTA instancia (el barrido completo de cada
    // evento los recorre todos; este Set evita duplicarlos).
    const emittedFinals = new Set<number>();

    recognition.onstart = () => {
      if (recognitionRef.current === recognition) setRecording(true);
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const { finals, interim: interimText } = processRecognitionResults(event.results, emittedFinals);
      for (const final of finals) onFinalRef.current(`${final.text} `, final.confidence);
      interimRef.current = interimText;
      setInterim(interimText);
    };

    recognition.onend = () => {
      // Solo la instancia vigente decide si reinicia (evita dobles capturas).
      if (recognitionRef.current !== recognition) return;
      // El interino que quedo colgado en el corte pasa a frase: no se pierde.
      flushInterim();
      setInterim("");
      if (activeRef.current) {
        scheduleRestart();
      } else {
        setRecording(false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Permiso de micrófono denegado. Habilitalo en el navegador (candado de la barra de direcciones), o tipeá directamente en el lienzo.");
        activeRef.current = false;
        setRecording(false);
      } else if (event.error === "audio-capture") {
        setError("No se detecta un micrófono. Conectá o habilitá uno, o tipeá directamente en el lienzo.");
        activeRef.current = false;
        setRecording(false);
      } else if (event.error === "network") {
        setError("El servicio de dictado perdió conexión. Se reintenta solo; mientras tanto podés tipear a mano.");
      }
      // "no-speech" / "aborted" son silencios o cortes normales: onend reinicia.
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Chrome tira si se arranca demasiado rapido tras un corte: reintentamos.
      scheduleRestart();
    }
  }, [flushInterim, teardownCurrent, scheduleRestart]);

  launchRef.current = launch;

  const start = useCallback(() => {
    if (getSpeechRecognitionConstructor() === null) {
      setSupported(false);
      return;
    }
    if (activeRef.current) return; // Ya activo: no dupliques la captura.
    setError("");
    activeRef.current = true;
    launch();
  }, [launch]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    // Antes de tumbar la instancia (que desmonta sus handlers), lo interino
    // pendiente se salva como frase.
    flushInterim();
    teardownCurrent();
    setInterim("");
    setRecording(false);
  }, [flushInterim, teardownCurrent]);

  useEffect(
    () => () => {
      activeRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      teardownCurrent();
    },
    [teardownCurrent]
  );

  return { supported, recording, interim, error, start, stop };
}
