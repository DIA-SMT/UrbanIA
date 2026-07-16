"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { DiagnosisPanel } from "@/components/projects/diagnosis-panel";
import type { ProjectDiagnosisView } from "@/lib/projects/shared";

export function DiagnosisBlock({
  projectId,
  ensureDraft,
  canGenerate,
  diagnosis,
  onDiagnosis
}: {
  projectId: string | null;
  ensureDraft: () => Promise<string | null>;
  canGenerate: boolean;
  diagnosis: ProjectDiagnosisView | null;
  onDiagnosis: (diagnosis: ProjectDiagnosisView) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    const id = projectId ?? (await ensureDraft());
    if (!id) {
      setError("Carga titulo y descripcion (40+ caracteres) para generar el diagnostico.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch(`/api/projects/${id}/diagnose`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo generar el diagnostico.");
      onDiagnosis(payload.diagnosis as ProjectDiagnosisView);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "No se pudo generar el diagnostico.");
    } finally {
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando el proyecto con la normativa anclada...
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

  if (!diagnosis) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
        <Sparkles className="mx-auto h-7 w-7 text-[#1f89f6]" />
        <p className="mt-3 text-sm font-bold text-slate-200">Generar diagnostico tecnico</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-400">
          La IA razona sobre la descripcion y la normativa anclada, cita el texto exacto y evalua la factibilidad. El equipo valida y edita.
        </p>
        <button type="button" onClick={generate} disabled={!canGenerate} className="urban-button mt-5 inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Sparkles className="h-4 w-4" />
          Generar diagnostico
        </button>
        {!canGenerate ? <p className="mt-3 text-xs text-slate-500">Necesitas titulo y una descripcion de al menos 40 caracteres.</p> : null}
        {error ? <p className="mt-3 text-xs font-bold text-amber-200">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {projectId ? <DiagnosisPanel projectId={projectId} diagnosis={diagnosis} canEdit onUpdated={onDiagnosis} /> : null}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={generate} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerar diagnostico
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-bold text-amber-200">{error}</p> : null}
    </div>
  );
}
