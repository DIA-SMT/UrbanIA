"use client";

import { useState } from "react";
import { BookMarked, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { AnswerSource } from "@/lib/ai/rag";

/**
 * Muestra la fuente única en la que se apoyó Migue. Al desplegarla, aparece el
 * texto del artículo con la frase de respaldo resaltada. Si no se pudo localizar
 * la cita, se muestra el texto completo sin resaltar (fallback seguro).
 */
export function SourceCitation({ source }: { source: AnswerSource }) {
  const [open, setOpen] = useState(false);
  const hasText = Boolean(source.before || source.match || source.after);

  return (
    <div className="mt-3 border-t border-slate-200 pt-2.5 dark:border-white/10">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-300">
        <BookMarked className="h-3 w-3" />
        Fuente
      </p>

      <div className="overflow-hidden rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-400/25 dark:bg-sky-400/10">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={!hasText}
          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition hover:bg-sky-100/60 disabled:cursor-default dark:hover:bg-sky-400/[0.08]"
          aria-expanded={open}
        >
          <FileText className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black text-slate-900 dark:text-white">{source.reference ?? "Documento"}</span>
            {source.title ? (
              <span className="block truncate text-[11px] leading-5 text-slate-500 dark:text-slate-400">{source.title}</span>
            ) : null}
          </span>
          {hasText ? (
            open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            )
          ) : null}
        </button>

        {open && hasText ? (
          <div className="border-t border-sky-200/70 bg-white/70 px-2.5 py-2.5 dark:border-white/10 dark:bg-slate-950/40">
            <p className="max-h-52 overflow-y-auto whitespace-pre-line text-[11px] leading-6 text-slate-600 dark:text-slate-300">
              {source.before}
              {source.match ? (
                <mark className="rounded-sm bg-[#f6d500]/40 px-1 text-slate-900 dark:bg-[#f6d500]/25 dark:text-amber-50">
                  {source.match}
                </mark>
              ) : null}
              {source.after}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
