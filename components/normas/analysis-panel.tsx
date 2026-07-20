"use client";

import { useState } from "react";
import { FeasibilityLevel } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import { ArticleCitation } from "@/components/projects/article-citation";
import { conflictLevelLabels, conflictLevelStyles, type ProjectDiagnosisView } from "@/lib/projects/shared";

/**
 * Analisis de impacto normativo en modo lectura + edicion humana. La edicion
 * marca editedByHuman en el server (trazabilidad exigida por AGENTS.md).
 */
export function AnalysisPanel({
  normId,
  analysis,
  canEdit,
  onUpdated
}: {
  normId: string;
  analysis: ProjectDiagnosisView;
  canEdit: boolean;
  onUpdated?: (analysis: ProjectDiagnosisView) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feasibility, setFeasibility] = useState<FeasibilityLevel>(analysis.feasibility);
  const [scope, setScope] = useState(analysis.scope);
  const [objective, setObjective] = useState(analysis.objective);
  const [analysisText, setAnalysisText] = useState(analysis.analysis);
  const [actions, setActions] = useState(analysis.actions.join("\n"));
  const [risks, setRisks] = useState(analysis.risks.join("\n"));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${normId}/diagnosis/${analysis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feasibility,
          scope,
          objective,
          analysis: analysisText,
          actions: actions.split("\n").map((line) => line.trim()).filter(Boolean),
          risks: risks.split("\n").map((line) => line.trim()).filter(Boolean)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo guardar la edición.");
      onUpdated?.(payload.diagnosis as ProjectDiagnosisView);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la edición.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Editar análisis</p>
          <button type="button" onClick={() => setEditing(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Nivel de conflicto normativo</span>
            <select
              value={feasibility}
              onChange={(event) => setFeasibility(event.target.value as FeasibilityLevel)}
              className="h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-sky-300/50"
            >
              {(Object.keys(conflictLevelLabels) as FeasibilityLevel[]).map((level) => (
                <option key={level} value={level}>{conflictLevelLabels[level]}</option>
              ))}
            </select>
          </label>
          <EditField label="Ámbito de aplicación" value={scope} onChange={setScope} />
          <EditField label="Objeto" value={objective} onChange={setObjective} />
          <EditArea label="Análisis de impacto" value={analysisText} onChange={setAnalysisText} rows={5} />
          <EditArea label="Recomendaciones (una por línea)" value={actions} onChange={setActions} rows={4} />
          <EditArea label="Conflictos detectados (uno por línea)" value={risks} onChange={setRisks} rows={3} />
          {error ? <p className="text-xs font-bold text-amber-200">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200">Cancelar</button>
            <button type="button" onClick={save} disabled={saving} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar edición
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${conflictLevelStyles[analysis.feasibility]}`}>
            {conflictLevelLabels[analysis.feasibility]}
          </span>
          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">Versión {analysis.version}</span>
          {analysis.editedByHuman ? (
            <span className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[11px] font-bold text-amber-100">Editado por el equipo</span>
          ) : null}
        </div>
        {canEdit ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Ámbito de aplicación" value={analysis.scope} />
        <Field label="Objeto de la norma" value={analysis.objective} />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Análisis de impacto sobre el código viejo</p>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-slate-300">{analysis.analysis}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Recomendaciones</p>
          <ul className="mt-2 space-y-2">
            {analysis.actions.length ? analysis.actions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{action}</li>
            )) : <li className="text-sm text-slate-500">Sin recomendaciones registradas.</li>}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Conflictos detectados</p>
          <ul className="mt-2 space-y-2">
            {analysis.risks.length ? analysis.risks.map((risk, index) => (
              <li key={index} className="flex items-start gap-2 text-sm leading-6 text-slate-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />{risk}</li>
            )) : <li className="text-sm text-slate-500">Sin conflictos registrados.</li>}
          </ul>
        </div>
      </div>

      {analysis.citedArticles.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Artículos del CPU 2014 citados</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {analysis.citedArticles.map((citation) => (
              <ArticleCitation key={`${citation.articleId}-${citation.quote.slice(0, 12)}`} citation={citation} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-sky-300/50" />
    </label>
  );
}

function EditArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-sky-300/50" />
    </label>
  );
}
