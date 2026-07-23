"use client";

import { useEffect, useLayoutEffect, useRef, type ChangeEvent } from "react";
import { Mic, MicOff } from "lucide-react";

// useLayoutEffect en cliente, useEffect en server (evita el warning de SSR).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Lienzo de transcripcion: el texto final en solido (editable: el operador
 * corrige o tipea si el dictado falla) y el tramo interino en gris.
 *
 * El dictado agrega texto al FINAL. Al re-renderizar, el navegador tiende a
 * mandar el cursor al final; para dejar editar mientras se dicta, preservamos
 * la posicion del cursor: si estabas editando mas arriba, te quedas ahi; si
 * estabas al final siguiendo el dictado, el cursor sigue al nuevo texto.
 */
export function TranscriptCanvas({
  value,
  interim,
  recording,
  supported,
  dictationError,
  elapsedLabel,
  onChange,
  onToggleDictation
}: {
  value: string;
  interim: string;
  recording: boolean;
  supported: boolean;
  dictationError: string;
  elapsedLabel: string;
  onChange: (value: string) => void;
  onToggleDictation: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const prevValueRef = useRef(value);
  const userEditRef = useRef(false);

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

    // Cambio programatico (dictado). Solo tocamos el cursor si el lienzo esta
    // enfocado; si no, el operador esta en otro lado y no lo interrumpimos.
    if (document.activeElement !== el) return;
    const sel = selectionRef.current;
    if (sel.end >= prev.length) {
      // Estabas al final: el cursor sigue al dictado.
      el.selectionStart = el.selectionEnd = value.length;
    } else {
      // Estabas editando mas arriba: el cursor se queda donde estaba.
      el.selectionStart = sel.start;
      el.selectionEnd = sel.end;
    }
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }, [value]);

  return (
    <section className="urban-card flex min-h-[60vh] flex-col rounded-lg p-4 lg:p-5">
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

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={rememberSelection}
        placeholder="Acá aparece lo que se va diciendo en la audiencia. También podés tipear o corregir a mano; el dictado sigue escribiendo al final."
        className="min-h-[44vh] w-full flex-1 resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
      />
      {interim ? (
        <p className="mt-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm italic leading-6 text-slate-500" aria-live="polite">
          {interim}
        </p>
      ) : null}
    </section>
  );
}
