"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type MouseEvent } from "react";
import { AArrowDown, AArrowUp, Bold } from "lucide-react";

/**
 * Notas del operador durante la audiencia. NO es la transcripcion: el acta la
 * escribe Whisper despues, sobre el audio grabado. Aca va lo que solo una
 * persona en la sala puede registrar — quien habla, momentos clave, aclaraciones.
 *
 * Editor (contentEditable) y no textarea: en tema claro una regla global pinta
 * los textarea de blanco con !important, y ademas asi funcionan la negrita
 * nativa (Ctrl+B) y los renglones como en Word.
 *
 * El editor es NO controlado: React pinta el contenido inicial UNA vez por
 * efecto y despues el DOM manda. Regla que no se puede romper: el div NO debe
 * tener children gestionados por React. Con dangerouslySetInnerHTML, React
 * re-aplicaba el HTML inicial en cada re-render (y la sesion re-renderiza cada
 * segundo por el reloj), borrando lo tipeado y mandando el cursor al inicio.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

export function NotesCanvas({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [initialHtml] = useState(() => escapeHtml(value).replace(/\n/g, "<br>"));
  useEffect(() => {
    const el = editorRef.current;
    // Guarda por doble efecto de StrictMode: si ya tiene contenido, no pisar.
    if (el && initialHtml && !el.innerHTML) el.innerHTML = initialHtml;
  }, [initialHtml]);

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

  /** Pegar SIEMPRE como texto plano: un paste desde Word no puede meter HTML. */
  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (text) document.execCommand("insertText", false, text);
  }

  function toggleBold(event: MouseEvent<HTMLButtonElement>) {
    // Sin robarle el foco al editor: la seleccion sigue viva para la negrita.
    event.preventDefault();
    document.execCommand("bold");
  }

  return (
    // Alto FIJO: las notas scrollean ADENTRO en vez de estirar la pagina.
    <section className="urban-card flex h-[calc(100vh-420px)] min-h-[320px] flex-col rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Notas de la audiencia</p>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
            Lo que anotes acá se guarda aparte y no se mezcla con la transcripción.
          </p>
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
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="Notas de la audiencia"
        data-placeholder="Anotá quién habla, los momentos importantes y todo lo que la grabación no va a poder decir por sí sola."
        onInput={() => onChangeRef.current(editorRef.current?.innerText ?? "")}
        onPaste={handlePaste}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.9 }}
        // min-h-0: sin esto un hijo flex se niega a achicarse y el overflow
        // interno (la barrita) nunca aparece.
        className="lienzo-editor urban-scrollbar min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-300/50"
      />
    </section>
  );
}
