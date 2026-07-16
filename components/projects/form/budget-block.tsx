"use client";

import { useMemo, useState } from "react";
import { BudgetCostType } from "@prisma/client";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { budgetBaseAmounts, budgetCostTypeLabels, budgetMultipliers, formatCurrency, type ProjectBudgetItemView } from "@/lib/projects/shared";

export function BudgetBlock({
  projectId,
  ensureDraft,
  items,
  onChange
}: {
  projectId: string | null;
  ensureDraft: () => Promise<string | null>;
  items: ProjectBudgetItemView[];
  onChange: (items: ProjectBudgetItemView[]) => void;
}) {
  const [concept, setConcept] = useState("");
  const [costType, setCostType] = useState<BudgetCostType>("OBRA");
  const [multiplier, setMultiplier] = useState(1);
  const [fundingSource, setFundingSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const baseAmount = budgetBaseAmounts[costType];
  const previewAmount = baseAmount * multiplier;
  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  async function addItem() {
    setError("");
    if (concept.trim().length < 2) {
      setError("Escribi un concepto para el item.");
      return;
    }
    const id = projectId ?? (await ensureDraft());
    if (!id) {
      setError("Carga titulo y descripcion (40+ caracteres) para agregar presupuesto.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${id}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: concept.trim(), costType, baseAmount, multiplier, fundingSource: fundingSource.trim() || undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo agregar el item.");
      onChange([...items, payload.item as ProjectBudgetItemView]);
      setConcept("");
      setFundingSource("");
      setMultiplier(1);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "No se pudo agregar el item.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId));
    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/budget?itemId=${itemId}`, { method: "DELETE" });
      } catch {
        // Ya se quito de la UI.
      }
    }
  }

  return (
    <div>
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Concepto</span>
          <input value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Obra civil de carril segregado" className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50" />
        </label>

        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Tipo de costo</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(budgetCostTypeLabels) as BudgetCostType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCostType(type)}
              className={`rounded-md border p-3 text-left transition ${costType === type ? "border-sky-300/50 bg-sky-300/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
            >
              <span className="block text-sm font-black text-slate-100">{budgetCostTypeLabels[type]}</span>
              <span className="mt-0.5 block text-xs text-slate-400">Base {formatCurrency(budgetBaseAmounts[type])}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Multiplicador</span>
            <select value={multiplier} onChange={(event) => setMultiplier(Number(event.target.value))} className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50">
              {budgetMultipliers.map((value) => (
                <option key={value} value={value}>{value}x</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Fuente de financiamiento</span>
            <input value={fundingSource} onChange={(event) => setFundingSource(event.target.value)} placeholder="Opcional" className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-300/20 bg-sky-300/[0.06] p-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Monto calculado</p>
            <p className="text-2xl font-black text-white">{formatCurrency(previewAmount)}</p>
          </div>
          <button type="button" onClick={addItem} disabled={saving} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar item
          </button>
        </div>
        {error ? <p className="mt-2 text-xs font-bold text-amber-200">{error}</p> : null}
      </div>

      <div className="mt-4">
        {items.length ? (
          <>
            <div className="grid gap-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-200">{item.concept}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {budgetCostTypeLabels[item.costType]} · {formatCurrency(item.baseAmount)} × {item.multiplier}x{item.fundingSource ? ` · ${item.fundingSource}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-white">{formatCurrency(item.amount)}</span>
                  <button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-slate-500 hover:text-rose-300" title="Quitar item">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-bold text-slate-300">Total estimado del proyecto</span>
              <span className="text-xl font-black text-white">{formatCurrency(total)}</span>
            </div>
          </>
        ) : (
          <EmptyState icon={Wallet} title="Sin items de presupuesto" description="Agrega conceptos con su tipo de costo y multiplicador para estimar el total." />
        )}
      </div>
    </div>
  );
}
