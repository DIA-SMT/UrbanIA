"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ChangeEvent, type ReactNode, type UIEvent } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import type { PendingPhrase } from "@/components/hearings/live/live-session";

// useLayoutEffect en cliente, useEffect en server (evita el warning de SSR).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Lienzo de transcripcion.
 *
 * El dictado NO escribe directo aca: las frases finales caen en la BANDEJA de
 * abajo y el operador las manda con "Enviar al lienzo" (o Ctrl+Enter). Asi el
 * texto entra en tramos revisables en vez de un chorro continuo.
 *
 * Frases dudosas: el reconocimiento informa confianza por frase; las que
 * vienen flojas se marcan en amarillo en la bandeja y SIGUEN marcadas en el
 * lienzo. El resaltado sobre un textarea se logra con la tecnica del fondo
 * espejado: un div detras renderiza el mismo texto invisible con <mark> en las
 * frases dudosas; el textarea (fondo transparente) va encima. Cuando el
 * operador corrige la frase, el texto ya no coincide y la marca se va sola.
 *
 * Edicion durante el dictado: al re-renderizar, el navegador tiende a mandar
 * el cursor al final; se preserva la posicion (si editabas arriba te quedas
 * ahi; si seguias el final, el cursor acompana).
 */

/** Rangos [inicio, fin) de cada aparicion de cada frase dudosa, fusionados. Exportada para testearla. */
export function dubiousRanges(text: string, phrases: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const phrase of phrases) {
    if (!phrase) continue;
    let from = 0;
    while (from <= text.length - phrase.length) {
      const at = text.indexOf(phrase, from);
      if (at < 0) break;
      ranges.push([at, at + phrase.length]);
      from = at + phrase.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range] as [number, number]);
  }
  return merged;
}

export function TranscriptCanvas({
  value,
  interim,
  pending,
  dubiousPhrases,
  recording,
  supported,
  dictationError,
  elapsedLabel,
  onChange,
  onSendPending,
  onToggleDictation
}: {
  value: string;
  interim: string;
  pending: PendingPhrase[];
  dubiousPhrases: string[];
  recording: boolean;
  supported: boolean;
  dictationError: string;
  elapsedLabel: string;
  onChange: (value: string) => void;
  onSendPending: () => void;
  onToggleDictation: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const prevValueRef = useRef(value);
  const userEditRef = useRef(false);

  const onSendRef = useRef(onSendPending);
  onSendRef.current = onSendPending;
  const hasPendingRef = useRef(pending.length > 0);
  hasPendingRef.current = pending.length > 0;

  function rememberSelection() {
    const el = textareaRef.current;
    if (el) selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    // El cambio lo dispara el usuario: se marca para no re-posicionar el cursor.
    userEditRef.current = true;
    onChange(event.target.value);
  }

  useIsomorphicLayoutEffect(() => {
    const el = textareaRef.current;
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (!el) return;

    if (userEditRef.current) {
      // Cambio del usuario: el navegador ya dejo el cursor donde tipeo.
      userEditRef.current = false;
      selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
      return;
    }

    // Cambio programatico (envio de la bandeja). Solo tocamos el cursor si el
    // lienzo esta enfocado; si no, el operador esta en otro lado.
    if (document.activeElement !== el) return;
    const sel = selectionRef.current;
    if (sel.end >= prev.length) {
      el.selectionStart = el.selectionEnd = value.length;
    } else {
      el.selectionStart = sel.start;
      el.selectionEnd = sel.end;
    }
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }, [value]);

  // El fondo espejado sigue el scroll del textarea (tambien tras cada cambio
  // de texto: el navegador puede auto-scrollear al escribir al final).
  function syncScroll(event?: UIEvent<HTMLTextAreaElement>) {
    const el = event?.currentTarget ?? textareaRef.current;
    const backdrop = backdropRef.current;
    if (el && backdrop) {
      backdrop.scrollTop = el.scrollTop;
      backdrop.scrollLeft = el.scrollLeft;
    }
  }
  useIsomorphicLayoutEffect(() => {
    syncScroll();
  }, [value, dubiousPhrases]);

  // Ctrl+Enter (o Cmd+Enter) manda la bandeja desde cualquier lado.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && hasPendingRef.current) {
        event.preventDefault();
        onSendRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const backdropContent = useMemo<ReactNode>(() => {
    if (!dubiousPhrases.length) return null;
    const ranges = dubiousRanges(value, dubiousPhrases);
    if (!ranges.length) return null;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(([from, to], index) => {
      if (from > cursor) nodes.push(value.slice(cursor, from));
      nodes.push(
        <mark key={index} className="rounded-sm bg-yellow-300/25 text-transparent">
          {value.slice(from, to)}
        </mark>
      );
      cursor = to;
    });
    if (cursor < value.length) nodes.push(value.slice(cursor));
    return nodes;
  }, [value, dubiousPhrases]);

  const dubiousActive = backdropContent !== null;

  return (
    // El alto persigue el final de la pantalla: 100vh menos el encabezado de la
    // sesion (~250px). El textarea es flex-1, asi que estira con la seccion.
    <section className="urban-card flex min-h-[calc(100vh-250px)] flex-col rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
                <span className="inline-flex h-3 w-3 rounded-full bg-slate-500" />
                Dictado en pausa
              </>
            )}
          </span>
          <span className="rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-bold text-sky-200">{elapsedLabel}</span>
        </div>
        {supported ? (
          <button
            type="button"
            onClick={onToggleDictation}
            className={`urban-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-black ${
              recording ? "border border-white/10 bg-white/[0.04] text-slate-200" : "bg-civic-blue text-white"
            }`}
          >
            {recording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {recording ? "Pausar dictado" : "Reanudar dictado"}
          </button>
        ) : null}
      </div>

      {!supported ? (
        <p className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          Este navegador no soporta el dictado automático. Usá Chrome o Edge para dictar; igual podés tipear o pegar la transcripción en el lienzo.
        </p>
      ) : null}
      {dictationError ? (
        <p className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{dictationError}</p>
      ) : null}
      {dubiousActive ? (
        <p className="mb-2 text-[11px] font-bold text-yellow-200/80">
          Lo <mark className="rounded-sm bg-yellow-300/25 px-1 text-yellow-100">amarillo</mark> son frases que el dictado marcó con dudas: revisalas; al corregirlas la marca se va sola.
        </p>
      ) : null}

      {/* Contenedor del lienzo: el div de atras pinta las marcas, el textarea
          (transparente) va encima. Fuente, padding e interlineado IDENTICOS. */}
      <div className="relative min-h-[46vh] flex-1 overflow-hidden rounded-md border border-white/10 bg-slate-950/60 transition focus-within:border-sky-300/50">
        <div
          ref={backdropRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3 text-sm leading-7 text-transparent"
        >
          {backdropContent}
          {"​"}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onSelect={rememberSelection}
          onScroll={syncScroll}
          placeholder="Acá aparece lo que vas enviando desde la bandeja de dictado. También podés tipear o corregir a mano."
          className="urban-scrollbar absolute inset-0 h-full w-full resize-none bg-transparent px-4 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600"
        />
      </div>

      {/* Bandeja de dictado: lo reconocido espera aca hasta que se envia. */}
      {supported && (pending.length > 0 || interim || recording) ? (
        <div className="mt-3 rounded-md border border-sky-300/20 bg-sky-300/[0.06] px-3 py-2.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-sky-200">
              Bandeja de dictado
              {pending.length ? ` · ${pending.length} ${pending.length === 1 ? "frase" : "frases"}` : ""}
            </p>
            <button
              type="button"
              onClick={onSendPending}
              disabled={pending.length === 0}
              title="Ctrl+Enter"
              className="urban-button inline-flex items-center gap-1.5 rounded-md bg-civic-blue px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar al lienzo
            </button>
          </div>
          <p className="text-sm leading-7 text-slate-200" aria-live="polite">
            {pending.map((phrase) =>
              phrase.dubious ? (
                <mark key={phrase.id} className="rounded-sm bg-yellow-300/25 px-0.5 text-yellow-100">
                  {phrase.text}{" "}
                </mark>
              ) : (
                <span key={phrase.id}>{phrase.text} </span>
              )
            )}
            {interim ? <span className="italic text-slate-500">{interim}</span> : null}
            {!pending.length && !interim ? <span className="italic text-slate-500">Escuchando…</span> : null}
          </p>
        </div>
      ) : null}
    </section>
  );
}
