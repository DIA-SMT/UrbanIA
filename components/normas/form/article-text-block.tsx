"use client";

import { Check, Sparkles } from "lucide-react";

/**
 * Bloque 3: texto del articulado. La sugerencia formalizada llega del paso 1
 * ("Formalizar con IA" en el bloque de objeto) y se muestra en un panel
 * comparativo; el humano decide si la usa y es el autor final.
 */
export function ArticleTextBlock({
  articleText,
  proposedText,
  disabled,
  onChange,
  onUseProposed
}: {
  articleText: string;
  proposedText: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onUseProposed: () => void;
}) {
  const showComparison = Boolean(proposedText && proposedText.trim() && proposedText.trim() !== articleText.trim());

  return (
    <div className="grid gap-3">
      <textarea
        value={articleText}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        placeholder={'Redactá el texto de la norma en estilo de articulado, o usá "Formalizar con IA" desde el bloque del objeto. Ej.: "Artículo 12.- En los corredores identificados como C2, la altura máxima de fachada será de..."'}
        className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-sm leading-7 text-slate-100 outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
      />

      {showComparison && !disabled ? (
        <div className="rounded-xl border border-sky-300/25 bg-sky-300/[0.06] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
              <Sparkles className="h-3.5 w-3.5" />
              Articulado formalizado por la IA
            </p>
            <button
              type="button"
              onClick={onUseProposed}
              className="urban-button inline-flex items-center gap-1.5 rounded-md bg-civic-blue px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Check className="h-3.5 w-3.5" />
              Usar este texto
            </button>
          </div>
          <p className="whitespace-pre-line font-mono text-sm leading-7 text-slate-200">{proposedText}</p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Es una sugerencia editable, nunca la palabra final: al usarla se copia al editor y podés corregirla antes de comparar con el código viejo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
