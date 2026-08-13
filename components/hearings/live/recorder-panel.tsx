"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { CloudUpload, Circle, Loader2, Mic, Square, TriangleAlert } from "lucide-react";

/**
 * Panel de grabacion de la audiencia: el boton, el cronometro, el medidor de
 * nivel y el estado de subida de los tramos.
 *
 * La grabacion NO arranca sola (decision del equipo): el microfono empieza a
 * grabar cuando alguien lo decide, no por entrar a la pantalla.
 */

/** Barras del medidor de nivel. */
const BARS = 12;

/**
 * Medidor de entrada del microfono. Lee el nivel de un ref con su PROPIO
 * intervalo en vez de recibirlo por prop: el nivel cambia ~7 veces por segundo
 * y pasarlo como estado re-renderizaria toda la sesion todo el tiempo.
 */
function LevelMeter({ level, active }: { level: MutableRefObject<number>; active: boolean }) {
  const [value, setValue] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const interval = setInterval(() => setValue(level.current), 150);
    return () => clearInterval(interval);
  }, [active, level]);

  return (
    <div ref={containerRef} className="flex items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: BARS }, (_, index) => {
        const threshold = (index + 1) / BARS;
        const on = active && value >= threshold;
        return (
          <span
            key={index}
            style={{ height: `${8 + index * 1.5}px` }}
            className={`w-[3px] rounded-full transition-colors ${
              on ? (threshold > 0.85 ? "bg-rose-400" : "bg-emerald-400") : "bg-white/15"
            }`}
          />
        );
      })}
    </div>
  );
}

export function RecorderPanel({
  supported,
  recording,
  starting,
  error,
  level,
  elapsedLabel,
  uploaded,
  pending,
  stuck,
  uploadError,
  recovered,
  recovering,
  onStart,
  onStop
}: {
  supported: boolean;
  recording: boolean;
  starting: boolean;
  error: string;
  level: MutableRefObject<number>;
  elapsedLabel: string;
  uploaded: number;
  pending: number;
  stuck: boolean;
  uploadError: string;
  /** Tramos rescatados del navegador tras una caida de la sesion anterior. */
  recovered: number;
  /** Buscando tramos pendientes en el navegador: hasta que termine no se graba. */
  recovering: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {recording ? (
            <button
              type="button"
              onClick={onStop}
              className="urban-button inline-flex items-center gap-2 rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-2.5 text-sm font-black text-rose-100"
            >
              <Square className="h-4 w-4" />
              Detener grabación
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={!supported || starting || recovering}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {starting || recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              {recovering
                ? "Revisando audio pendiente…"
                : starting
                  ? "Pidiendo el micrófono…"
                  : uploaded + pending > 0
                    ? "Reanudar grabación"
                    : "Comenzar a grabar"}
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-black text-white">
              {recording ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                  Grabando
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 text-slate-500" />
                  <span className="text-slate-300">Sin grabar</span>
                </>
              )}
            </span>
            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-bold text-sky-200">{elapsedLabel}</span>
            <LevelMeter level={level} active={recording} />
          </div>
        </div>

        {/* Estado de subida: lo que da la tranquilidad de que el audio ya no
            depende de esta computadora. */}
        <div className="flex items-center gap-2 text-xs font-bold">
          {stuck || uploadError ? (
            <span className="inline-flex items-center gap-1.5 text-amber-200">
              <TriangleAlert className="h-3.5 w-3.5" />
              {pending} sin subir, reintentando
            </span>
          ) : pending > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Subiendo {pending} {pending === 1 ? "tramo" : "tramos"}
            </span>
          ) : uploaded > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CloudUpload className="h-3.5 w-3.5" />
              {uploaded} {uploaded === 1 ? "tramo guardado" : "tramos guardados"}
            </span>
          ) : null}
        </div>
      </div>

      {recovered > 0 ? (
        <p className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold leading-5 text-emerald-100">
          Se recuperaron {recovered} {recovered === 1 ? "tramo de audio" : "tramos de audio"} que habían quedado sin subir en esta
          computadora. Se están subiendo ahora.
        </p>
      ) : null}

      {!supported ? (
        <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          Este navegador no puede grabar audio. Usá Chrome o Edge actualizados.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{error}</p>
      ) : null}
      {stuck || uploadError ? (
        <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2">
          <p className="text-xs font-black text-amber-100">Hay tramos de audio que no se pudieron subir</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-100/80">
            {uploadError} Se reintenta solo cada minuto. Ese audio ya está <strong>guardado en esta computadora</strong>, así que sobrevive a
            cerrar el navegador: si la pantalla queda rara, recargarla es seguro y vuelve a intentar la subida. Lo único que todavía no está
            guardado es el tramo que se está grabando ahora (hasta 5 minutos).
          </p>
        </div>
      ) : null}

      {recording ? (
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          El audio se guarda en tramos de 5 minutos que se suben solos mientras la audiencia transcurre. La transcripción se genera después,
          desde el detalle de la audiencia, con “Analizar audio”.
        </p>
      ) : null}
    </section>
  );
}
