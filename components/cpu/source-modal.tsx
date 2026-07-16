"use client";

import { useEffect, useRef } from "react";
import { BookOpen, ScrollText, X } from "lucide-react";
import { locateQuote } from "@/lib/text/locate-quote";

/**
 * Modal con el texto de una fuente citada (artículo del CPU o fragmento de una
 * norma del digesto/planillas), sin salir del chat. Si la respuesta trajo una
 * cita textual, se resalta la frase y se scrollea hasta ella; si la cita no se
 * localiza, se muestra el texto sin resaltar (fallback seguro).
 */
export function SourceModal({
  heading,
  subheading,
  content,
  quote,
  footnote,
  onClose,
  explorerAction
}: {
  heading: string;
  subheading?: string | null;
  content: string;
  quote?: string | null;
  /** Aclaración fija del pie (ej. alcance del fragmento). */
  footnote?: string;
  onClose: () => void;
  explorerAction?: { label: string; onClick: () => void };
}) {
  const located = locateQuote(content, quote ?? "");
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(2,6,23,0.4)] dark:border-white/10 dark:bg-[#0d1b2a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
            <ScrollText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-950 dark:text-white">{heading}</p>
            {subheading ? (
              <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{subheading}</p>
            ) : null}
          </div>
          {explorerAction ? (
            <button
              type="button"
              onClick={explorerAction.onClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
              title={explorerAction.label}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{explorerAction.label}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="Cerrar fuente"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="urban-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <p className="whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
            {located.before}
            {located.match ? (
              <mark
                ref={markRef}
                className="rounded-sm bg-[#f6d500]/40 px-1 text-slate-900 dark:bg-[#f6d500]/25 dark:text-amber-50"
              >
                {located.match}
              </mark>
            ) : null}
            {located.after}
          </p>
        </div>

        <div className="shrink-0 border-t border-slate-200 px-4 py-2.5 dark:border-white/10">
          <p className="text-[11px] leading-4 text-slate-400 dark:text-slate-500">
            {located.match
              ? "El resaltado indica la frase en la que se apoyó la respuesta."
              : quote
                ? "No se pudo localizar la cita textual en esta fuente; se muestra sin resaltar."
                : footnote ?? "Texto ordenado a mayo de 2014 · vigencia posterior no verificada."}
          </p>
        </div>
      </div>
    </div>
  );
}
