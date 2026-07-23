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

type MinimalSpeechAlternative = { transcript: string };
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

const RESTART_DELAY_MS = 350;

export function useDictation({ onFinalText }: { onFinalText: (text: string) => void }) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchRef = useRef<() => void>(() => {});

  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

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

    // Tumba cualquier instancia previa antes de crear la nueva.
    teardownCurrent();

    const recognition = new Recognition();
    recognition.lang = "es-AR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      if (recognitionRef.current === recognition) setRecording(true);
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalPiece = transcript.trim();
          if (finalPiece) onFinalRef.current(`${finalPiece} `);
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    recognition.onend = () => {
      // Solo la instancia vigente decide si reinicia (evita dobles capturas).
      if (recognitionRef.current !== recognition) return;
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
  }, [teardownCurrent, scheduleRestart]);

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
    teardownCurrent();
    setInterim("");
    setRecording(false);
  }, [teardownCurrent]);

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
