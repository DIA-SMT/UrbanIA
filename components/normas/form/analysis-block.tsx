"use client";

import { History, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { AnalysisPanel } from "@/components/normas/analysis-panel";
import type { ProjectDiagnosisView } from "@/lib/projects/shared";

function formatVersionDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Bloque 5: analisis de impacto normativo con historial de versiones.
 * Cada corrida persiste una version nueva; la trazabilidad muestra cuales
 * fueron editadas por el equipo.
 */
export function AnalysisBlock({
  normId,
  analyses,
  activeIndex,
  canGenerate,
  generating,
  canEdit,
  error,
  onSelectVersion,
  onGenerate,
  onUpdated
}: {
  normId: string | null;
  analyses: ProjectDiagnosisView[];
  activeIndex: number;
  canGenerate: boolean;
  generating: boolean;
  canEdit: boolean;
  error: string;
  onSelectVersion: (index: number) => void;
  onGenerate: () => void;
  onUpdated: (analysis: ProjectDiagnosisView) => void;
}) {
  const active = analyses[activeIndex] ?? null;

  if (generating) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Comparando la norma formalizada contra el CPU 2014 y detectando artículos afectados...
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
        <Sparkles className="mx-auto h-7 w-7 text-[#1f89f6]" />
        <p className="mt-3 text-sm font-bold text-slate-200">Comparar con el código viejo</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-400">
          La IA busca en el CPU 2014 los artículos que la norma formalizada toca, marca la relación de cada uno (modifica, deroga, reemplaza, refiere o posible conflicto) y produce las recomendaciones y los conflictos. El equipo revisa cada anclaje.
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            title={!canGenerate ? "Formalizá la norma primero" : undefined}
            className="urban-button mt-5 inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Comparar con el código viejo
          </button>
        ) : null}
        {!canGenerate && canEdit ? <p className="mt-3 text-xs text-slate-500">Formalizá la norma primero: la comparación necesita el texto del articulado.</p> : null}
        {error ? <p className="mt-3 text-xs font-bold text-amber-200">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {analyses.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            <History className="h-3 w-3" />
            Historial
          </span>
          {analyses.map((analysis, index) => (
            <button
              key={analysis.id}
              type="button"
              onClick={() => onSelectVersion(index)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                index === activeIndex ? "bg-civic-blue text-white" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
              }`}
            >
              v{analysis.version} · {formatVersionDate(analysis.createdAt)}
              {analysis.editedByHuman ? " · editada" : ""}
            </button>
          ))}
        </div>
      ) : null}

      {normId ? <AnalysisPanel normId={normId} analysis={active} canEdit={canEdit} onUpdated={onUpdated} /> : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            title={!canGenerate ? "Formalizá la norma primero" : undefined}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Volver a comparar
          </button>
          <p className="text-xs text-slate-500">Vuelve a detectar los artículos afectados y actualiza los anclajes de la IA sin tocar los manuales.</p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs font-bold text-amber-200">{error}</p> : null}
    </div>
  );
}
