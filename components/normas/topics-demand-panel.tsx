"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, MapPin, MessageSquareQuote, PenLine, Users, X } from "lucide-react";
import { SectionTitle } from "@/components/ui/board-ui";
import type { ContributionSample, TopicDemand, TopicsDemandPayload } from "@/lib/citizen/shared";
import type { ReformListItem } from "@/lib/projects/shared";

/**
 * Que esta pidiendo la ciudadania, leido desde los aportes reales.
 *
 * Dos criterios de producto que explican por que esto no es un simple ranking:
 *
 * - Lo que el CPU no regula NO se esconde ni se atenua. El vecino escribio igual, y
 *   su aporte se muestra con su texto a la vista. Lo unico que no habilita es
 *   redactar una norma, porque el Codigo no puede regular eso.
 * - La demanda directa y la relacionada se cuentan por separado. Sumarlas inflaria
 *   el pedido: un reclamo de basura no es un pedido de norma sobre usos del suelo,
 *   aunque el Articulo 20 lo roce.
 */

const ACTIVE_REFORM_STATUSES = ["DRAFT", "IN_REVIEW"];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function TopicsDemandPanel({
  demand,
  reforms,
  canCreate
}: {
  demand: TopicsDemandPayload;
  reforms: ReformListItem[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);

  // Solo los codigos vivos reciben normas nuevas: sumar una norma a un codigo ya
  // consolidado o archivado seria editar algo que se dio por cerrado.
  const activeReforms = useMemo(
    () => reforms.filter((reform) => ACTIVE_REFORM_STATUSES.includes(reform.status)),
    [reforms]
  );

  const maxTotal = useMemo(
    () => Math.max(1, ...demand.topics.map((topic) => topic.total + topic.relatedTotal)),
    [demand.topics]
  );

  function draftNorm(axisLabel: string, reformId: string) {
    const query = new URLSearchParams({ materia: "PLANEAMIENTO", tema: axisLabel });
    router.push(`/normas/${reformId}/nueva?${query.toString()}`);
  }

  function startDraft(axisLabel: string) {
    if (activeReforms.length === 1) {
      draftNorm(axisLabel, activeReforms[0].id);
      return;
    }
    setPendingTopic(axisLabel);
  }

  const hasAnyDemand = demand.totalContributions > 0;

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <SectionTitle icon={Users}>Temas más pedidos por los vecinos</SectionTitle>

      {!hasAnyDemand ? (
        <p className="rounded-md border border-white/8 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
          Todavía no hay aportes ciudadanos cargados. Cuando los vecinos empiecen a presentar propuestas y reclamos, acá vas a ver
          qué temas del Código son los más pedidos.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {demand.topics.map((topic) => (
              <TopicRow
                key={topic.axisLabel}
                topic={topic}
                maxTotal={maxTotal}
                canCreate={canCreate && activeReforms.length > 0}
                onDraft={() => startDraft(topic.axisLabel)}
              />
            ))}
          </div>

          {demand.outOfScope ? <OutOfScopeBlock topic={demand.outOfScope} /> : null}

          {demand.legacy.length ? (
            <div className="rounded-md border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-xs font-semibold text-slate-300">Ejes de una taxonomía anterior</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Estos aportes se etiquetaron con ejes que ya no existen en el Código. Hay que reclasificarlos para que cuenten.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {demand.legacy.map((topic) => (
                  <span key={topic.axisLabel} className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400">
                    {topic.axisLabel} · {topic.total}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {demand.unclassifiedCount ? (
            <p className="inline-flex items-center gap-2 text-xs text-slate-400">
              <AlertCircle className="h-3.5 w-3.5 text-amber-200" />
              <span>
                <span className="font-semibold text-amber-200">{demand.unclassifiedCount}</span> aporte
                {demand.unclassifiedCount === 1 ? "" : "s"} sin clasificar. No entran en el ranking hasta que alguien les asigne un eje.
              </span>
            </p>
          ) : null}
        </div>
      )}

      {pendingTopic ? (
        <PickReformModal
          topic={pendingTopic}
          reforms={activeReforms}
          onPick={(reformId) => draftNorm(pendingTopic, reformId)}
          onClose={() => setPendingTopic(null)}
        />
      ) : null}
    </section>
  );
}

function TopicRow({
  topic,
  maxTotal,
  canCreate,
  onDraft
}: {
  topic: TopicDemand;
  maxTotal: number;
  canCreate: boolean;
  onDraft: () => void;
}) {
  const lastAt = formatDate(topic.lastContributionAt);
  const width = Math.round(((topic.total + topic.relatedTotal) / maxTotal) * 100);

  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-white">{topic.axisLabel}</h3>
            {topic.chapters.length ? (
              <span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                Cap. {topic.chapters.join(", ")}
              </span>
            ) : null}
          </div>
          {topic.summary ? <p className="mt-1 text-xs leading-5 text-slate-400">{topic.summary}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-white">{topic.total}</p>
            <p className="text-[11px] text-slate-500">
              {topic.total === 1 ? "aporte" : "aportes"}
              {topic.confirmed ? ` · ${topic.confirmed} confirmado${topic.confirmed === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={onDraft}
              className="urban-button inline-flex shrink-0 items-center gap-1.5 rounded-md bg-civic-blue px-3 py-2 text-xs font-bold text-white"
            >
              <PenLine className="h-3.5 w-3.5" />
              Redactar norma
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div className="h-full rounded-full bg-[#1f89f6]" style={{ width: `${width}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {topic.topZones.length ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {topic.topZones.join(" · ")}
          </span>
        ) : null}
        {lastAt ? <span>Último aporte: {lastAt}</span> : null}
        {topic.relatedTotal ? (
          <span className="text-slate-400">
            + {topic.relatedTotal} relacionado{topic.relatedTotal === 1 ? "" : "s"} desde fuera del Código
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Lo que el Codigo no regula, con los aportes a la vista. Bloque propio y legible:
 * la decision es que el vecino se vea, no que se archive en gris.
 */
function OutOfScopeBlock({ topic }: { topic: TopicDemand }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-amber-200/20 bg-amber-200/[0.04] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-amber-100">{topic.axisLabel}</h3>
          <p className="mt-1 text-xs leading-5 text-amber-100/70">
            Servicios urbanos que el Código de Planeamiento no regula: arbolado, basura, luminarias, veredas, tránsito. No se
            redacta una norma sobre esto, pero son pedidos reales de vecinos y hay que derivarlos.
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-amber-100">{topic.total}</p>
          <p className="text-[11px] text-amber-100/60">{topic.total === 1 ? "aporte" : "aportes"}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-100/60">
        {topic.topZones.length ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {topic.topZones.join(" · ")}
          </span>
        ) : null}
        {topic.samples.length ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="font-semibold text-amber-100 underline-offset-2 hover:underline">
            {open ? "Ocultar los aportes" : `Ver qué escribieron (${topic.samples.length})`}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          {topic.samples.map((sample) => (
            <ContributionQuote key={sample.id} sample={sample} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContributionQuote({ sample }: { sample: ContributionSample }) {
  return (
    <figure className="rounded-md border border-white/8 bg-slate-950/40 p-3">
      <blockquote className="flex gap-2 text-xs leading-6 text-slate-300">
        <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span>{sample.text}</span>
      </blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {sample.zone}
        </span>
        <span>{formatDate(sample.createdAt)}</span>
        {sample.relatedTopic ? <span className="text-sky-200/70">Se relaciona con {sample.relatedTopic}</span> : null}
        {!sample.axisConfirmed ? <span className="text-slate-600">Eje sugerido, sin confirmar</span> : null}
      </figcaption>
      {sample.axisReason ? <p className="mt-2 border-t border-white/8 pt-2 text-[11px] leading-5 text-slate-500">{sample.axisReason}</p> : null}
    </figure>
  );
}

function PickReformModal({
  topic,
  reforms,
  onPick,
  onClose
}: {
  topic: string;
  reforms: ReformListItem[];
  onPick: (reformId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="urban-card w-full max-w-lg rounded-xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">¿A qué código nuevo pertenece?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              La norma sobre <span className="font-semibold text-slate-200">{topic}</span> se va a redactar dentro del código que elijas.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-2">
          {reforms.map((reform) => (
            <button
              key={reform.id}
              type="button"
              onClick={() => onPick(reform.id)}
              className="urban-lift flex items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3 text-left"
            >
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-slate-500">{reform.code}</p>
                <p className="truncate text-sm font-semibold text-white">{reform.title}</p>
                <p className="text-[11px] text-slate-500">
                  {reform.normCount} {reform.normCount === 1 ? "norma" : "normas"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#1f89f6]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
