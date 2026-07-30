"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent
} from "react";
import { AArrowDown, AArrowUp, Bold, Mic, MicOff, Send } from "lucide-react";
import type { PendingPhrase } from "@/components/hearings/live/live-session";

/**
 * Lienzo de transcripcion como EDITOR (contentEditable), no textarea.
 *
 * Por que no un textarea con overlay: en tema claro una regla global pinta los
 * textarea de blanco con !important y tapa cualquier resaltado dibujado detras.
 * Con contentEditable la marca amarilla es un elemento real dentro del texto
 * (letra negra sobre amarillo solido, igual en ambos temas), la negrita nativa
 * funciona (Ctrl+B o el boton) y Enter hace salto de renglon como en Word.
 *
 * El editor es NO controlado: React pinta el contenido inicial una sola vez y
 * despues el DOM manda. El dictado no escribe aca directo: las frases caen en
 * la bandeja y entran con "Enviar al lienzo" (cada envio en renglon nuevo),
 * appendeadas al final sin tocar el cursor del operador. El texto plano para
 * guardar/analizar sale de innerText: el formato es una ayuda visual de la
 * sesion, el acta se conserva como texto.
 *
 * Frases dudosas: llegan de la bandeja envueltas en <mark class="dictado-marca">.
 * Un click sobre la marca la quita (el texto queda).
 */

export type TranscriptCanvasHandle = {
  /** Agrega frases al final (en renglon nuevo) y devuelve el texto plano resultante. */
  appendPhrases: (phrases: PendingPhrase[]) => string;
  getText: () => string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

export const TranscriptCanvas = forwardRef<
  TranscriptCanvasHandle,
  {
    value: string;
    interim: string;
    pending: PendingPhrase[];
    recording: boolean;
    supported: boolean;
    dictationError: string;
    elapsedLabel: string;
    onChange: (value: string) => void;
    onSendPending: () => void;
    onToggleDictation: () => void;
  }
>(function TranscriptCanvas(
  { value, interim, pending, recording, supported, dictationError, elapsedLabel, onChange, onSendPending, onToggleDictation },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Contenido inicial, UNA sola vez (borrador recuperado o vacio). Despues el
  // DOM es la fuente: React no vuelve a pisar el innerHTML porque este string
  // no cambia nunca.
  const [initialHtml] = useState(() => escapeHtml(value).replace(/\n/g, "<br>"));

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSendRef = useRef(onSendPending);
  onSendRef.current = onSendPending;
  const hasPendingRef = useRef(pending.length > 0);
  hasPendingRef.current = pending.length > 0;

  // Tamano de letra (A- / A+), recordado entre sesiones.
  const FONT_MIN = 12;
  const FONT_MAX = 24;
  const [fontSize, setFontSize] = useState(14);
  useEffect(() => {
    const stored = Number(window.localStorage.getItem("hearing-canvas-font-size"));
    if (Number.isFinite(stored) && stored >= FONT_MIN && stored <= FONT_MAX) setFontSize(stored);
  }, []);
  function adjustFont(delta: number) {
    setFontSize((current) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, current + delta));
      window.localStorage.setItem("hearing-canvas-font-size", String(next));
      return next;
    });
  }

  function getText(): string {
    return editorRef.current?.innerText ?? "";
  }

  useImperativeHandle(ref, () => ({
    getText,
    appendPhrases: (phrases: PendingPhrase[]) => {
      const editor = editorRef.current;
      if (!editor || !phrases.length) return getText();

      const fragment = document.createDocumentFragment();
      // Cada envio arranca en renglon nuevo (pedido del operador: nada de
      // chorizo continuo).
      if (editor.innerText.trim().length > 0) fragment.appendChild(document.createElement("br"));
      phrases.forEach((phrase, index) => {
        if (index > 0) fragment.appendChild(document.createTextNode(" "));
        if (phrase.dubious) {
          const mark = document.createElement("mark");
          mark.className = "dictado-marca";
          mark.title = "Frase que el dictado marcó con dudas — click para quitar la marca";
          mark.textContent = phrase.text;
          fragment.appendChild(mark);
        } else {
          fragment.appendChild(document.createTextNode(phrase.text));
        }
      });
      fragment.appendChild(document.createTextNode(" "));
      editor.appendChild(fragment);
      editor.scrollTop = editor.scrollHeight;

      const text = getText();
      onChangeRef.current(text);
      return text;
    }
  }));

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

  /** Pegar SIEMPRE como texto plano: un paste desde Word no puede meter HTML. */
  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (text) document.execCommand("insertText", false, text);
  }

  /** Click sobre una marca amarilla: la quita y el texto queda normal. */
  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const mark = target.closest("mark.dictado-marca");
    if (!mark || !editorRef.current?.contains(mark)) return;
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    onChangeRef.current(getText());
  }

  function toggleBold(event: MouseEvent<HTMLButtonElement>) {
    // Sin robarle el foco al editor: la seleccion sigue viva para aplicar la negrita.
    event.preventDefault();
    document.execCommand("bold");
  }

  return (
    // El alto persigue el final de la pantalla: 100vh menos el encabezado de la
    // sesion (~250px). El editor es flex-1, asi que estira con la seccion.
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={toggleBold}
            title="Negrita sobre el texto seleccionado (Ctrl+B)"
            aria-label="Negrita"
            className="urban-button rounded-md border border-white/10 px-2.5 py-2 text-slate-300 hover:bg-white/[0.06]"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <div className="inline-flex items-center overflow-hidden rounded-md border border-white/10">
            <button
              type="button"
              onClick={() => adjustFont(-2)}
              disabled={fontSize <= FONT_MIN}
              title="Letra más chica"
              aria-label="Letra más chica"
              className="urban-button px-2.5 py-2 text-slate-300 hover:bg-white/[0.06] disabled:opacity-40"
            >
              <AArrowDown className="h-3.5 w-3.5" />
            </button>
            <span className="border-x border-white/10 px-2 text-[11px] font-bold text-slate-400">{fontSize}px</span>
            <button
              type="button"
              onClick={() => adjustFont(2)}
              disabled={fontSize >= FONT_MAX}
              title="Letra más grande"
              aria-label="Letra más grande"
              className="urban-button px-2.5 py-2 text-slate-300 hover:bg-white/[0.06] disabled:opacity-40"
            >
              <AArrowUp className="h-3.5 w-3.5" />
            </button>
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
      </div>

      {!supported ? (
        <p className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          Este navegador no soporta el dictado automático. Usá Chrome o Edge para dictar; igual podés tipear o pegar la transcripción en el lienzo.
        </p>
      ) : null}
      {dictationError ? (
        <p className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{dictationError}</p>
      ) : null}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="Lienzo de transcripción"
        data-placeholder="Acá aparece lo que vas enviando desde la bandeja de dictado. También podés tipear, dar formato con negrita o corregir a mano."
        onInput={() => onChangeRef.current(getText())}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.9 }}
        className="lienzo-editor urban-scrollbar min-h-[46vh] flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-300/50"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />

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
                <span key={phrase.id}>
                  <mark className="dictado-marca">{phrase.text}</mark>{" "}
                </span>
              ) : (
                <span key={phrase.id}>{phrase.text} </span>
              )
            )}
            {interim ? <span className="italic text-slate-500">{interim}</span> : null}
            {!pending.length && !interim ? <span className="italic text-slate-500">Escuchando…</span> : null}
          </p>
          {pending.some((phrase) => phrase.dubious) ? (
            <p className="mt-1 text-[11px] font-bold text-slate-500">
              Lo <mark className="dictado-marca">amarillo</mark> son frases que el dictado marcó con dudas: en el lienzo, un click sobre la marca la quita.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});
