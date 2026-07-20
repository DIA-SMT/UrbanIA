"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Factory, FileStack, Loader2, Plus, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthorLine, MetricStrip, SectionTitle } from "@/components/ui/board-ui";
import { TopicsDemandPanel } from "@/components/normas/topics-demand-panel";
import type { TopicsDemandPayload } from "@/lib/citizen/shared";
import { reformStatusLabels, reformStatusStyles, type ReformListItem } from "@/lib/projects/shared";

/**
 * Pantalla principal de la Fabrica de Normas: los codigos nuevos en
 * construccion, con sus metricas de avance y la demanda ciudadana que los motiva.
 */
export function ReformsBoard({
  reforms,
  isLive,
  canCreate,
  demand
}: {
  reforms: ReformListItem[];
  isLive: boolean;
  canCreate: boolean;
  demand: TopicsDemandPayload;
}) {
  const [creating, setCreating] = useState(false);

  const metrics = useMemo(
    () => ({
      total: reforms.length,
      drafts: reforms.reduce((sum, reform) => sum + reform.draftCount, 0),
      inReview: reforms.reduce((sum, reform) => sum + reform.inReviewCount, 0),
      consolidated: reforms.reduce((sum, reform) => sum + reform.consolidatedCount, 0)
    }),
    [reforms]
  );

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                <Factory className="h-4 w-4" />
                Fábrica de Normas
              </div>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-4xl">Códigos nuevos en construcción</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                El código de planeamiento nuevo se redacta norma por norma, consultando el CPU 2014: cada artículo se ancla al texto viejo, la IA detecta conflictos y el equipo redacta la versión final.
              </p>
            </div>
            {canCreate ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Nuevo código
              </button>
            ) : null}
          </div>

          <div className="mt-6">
            <MetricStrip
              items={[
                { label: "códigos nuevos", value: metrics.total },
                { label: "en borrador", value: metrics.drafts },
                { label: "en revisión", value: metrics.inReview },
                { label: "consolidadas", value: metrics.consolidated }
              ]}
            />
          </div>
        </div>
      </section>

      {canCreate ? <TopicsDemandPanel demand={demand} reforms={reforms} canCreate={canCreate} /> : null}

      <section className="urban-card rounded-lg p-4 lg:p-5">
        {reforms.length ? (
          <>
            <SectionTitle icon={FileStack}>Códigos en construcción</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reforms.map((reform) => (
                <ReformCard key={reform.id} reform={reform} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Factory}
            title={isLive ? "Todavía no hay códigos nuevos" : "No pudimos conectar con la base de datos"}
            description={
              isLive
                ? "Un código nuevo agrupa las normas (artículos) que van a reemplazar al CPU 2014. Creá el primero para empezar a redactar."
                : "La Fábrica de Normas necesita conexión a la base para listar los códigos en construcción."
            }
            action={
              canCreate && isLive ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo código
                </button>
              ) : undefined
            }
          />
        )}
      </section>

      {creating ? <CreateReformModal onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function ReformCard({ reform }: { reform: ReformListItem }) {
  return (
    <div className="urban-lift flex flex-col rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-slate-400">{reform.code}</span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${reformStatusStyles[reform.status]}`}>
          {reformStatusLabels[reform.status]}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold leading-6 text-white">{reform.title}</h3>
      {reform.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{reform.description}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <FileStack className="h-3.5 w-3.5 text-[#1f89f6]" />
          {reform.normCount} {reform.normCount === 1 ? "norma" : "normas"}
        </span>
        {reform.conflictCount ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {reform.conflictCount} con conflictos
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <AuthorLine name={reform.authorName} />
      </div>
      <Link
        href={`/normas/${reform.id}`}
        className="urban-button mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white"
      >
        Abrir
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CreateReformModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/reforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo crear el código nuevo.");
      router.push(`/normas/${payload.reform.id}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el código nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="urban-card w-full max-w-lg rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Nuevo código</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Código de Planeamiento Urbano 2026"
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Objeto y alcance (opcional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Qué pretende reformar este código nuevo y con qué alcance."
              className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
            />
          </label>
          {error ? <p className="text-xs font-bold text-amber-200">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200">
              Cancelar
            </button>
            <button
              type="button"
              onClick={create}
              disabled={saving || !title.trim()}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear código
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
