"use client";

import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { ConclusionsFields } from "@/components/hearings/conclusions-fields";
import type { HearingConclusions } from "@/lib/hearings/shared";

/**
 * Paso de cierre: la Ficha 2 (conclusiones y temas observados). Migue las
 * precarga del debate y el operador las revisa/edita antes de guardar. La IA
 * orienta; el operador es el autor final.
 */
export function ClosingReview({
  value,
  saving,
  error,
  onChange,
  onBack,
  onSave
}: {
  value: HearingConclusions;
  saving: boolean;
  error: string;
  onChange: (conclusions: HearingConclusions) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a la audiencia
      </button>

      <section className="urban-card rounded-lg p-5 lg:p-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
          <Sparkles className="h-4 w-4" />
          Cierre · Migue redactó, revisá y corregí
        </div>
        <h1 className="text-2xl font-black leading-tight text-white">Conclusiones y temas observados</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          Migue redactó estas conclusiones a partir del debate. Revisalas y corregí lo que haga falta: al guardar, la audiencia queda finalizada. La IA orienta; vos sos el autor final.
        </p>

        <div className="mt-6">
          <ConclusionsFields value={value} disabled={saving} onChange={onChange} />
        </div>

        {error ? <p className="mt-4 text-xs font-bold text-amber-200">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Guardando y cerrando..." : "Guardar y cerrar audiencia"}
          </button>
          <button type="button" onClick={onBack} disabled={saving} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 disabled:opacity-60">
            Volver a la audiencia
          </button>
        </div>
      </section>
    </div>
  );
}
