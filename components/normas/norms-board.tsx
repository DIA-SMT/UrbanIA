"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MunicipalArea, ProjectStatus, ReformStatus } from "@prisma/client";
import { Anchor, ArrowLeft, FileDown, FileStack, FileText, MessageSquare, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthorLine, FilterBar, FilterChip, FilterGroup, MetricStrip } from "@/components/ui/board-ui";
import {
  conflictLevelLabels,
  conflictLevelStyles,
  materiaLabels,
  normStatusLabels,
  normStatusStyles,
  normVisibleStatuses,
  reformStatusLabels,
  type NormListItem,
  type ReformDetail
} from "@/lib/projects/shared";

type StatusFilter = ProjectStatus | "ALL";
type MateriaFilter = MunicipalArea | "ALL";

/** Interior de un codigo nuevo: sus normas, con filtros por estado y materia. */
export function NormsBoard({ reform, canEdit }: { reform: ReformDetail; canEdit: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [materia, setMateria] = useState<MateriaFilter>("ALL");
  const [statusSaving, setStatusSaving] = useState(false);

  const visible = useMemo(
    () =>
      reform.norms.filter(
        (norm) => (status === "ALL" || norm.status === status) && (materia === "ALL" || norm.areas.includes(materia))
      ),
    [reform.norms, status, materia]
  );

  async function changeReformStatus(next: ReformStatus) {
    setStatusSaving(true);
    try {
      await fetch(`/api/reforms/${reform.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      router.refresh();
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="p-5 lg:p-7">
          <Link href="/normas" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Fábrica de Normas
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-400">{reform.code}</span>
                {canEdit ? (
                  <select
                    value={reform.status}
                    disabled={statusSaving}
                    onChange={(event) => changeReformStatus(event.target.value as ReformStatus)}
                    className="h-8 rounded-md border border-white/10 bg-slate-950/60 px-2 text-xs font-bold text-slate-100 outline-none focus:border-sky-300/50 disabled:opacity-60"
                    aria-label="Estado del código nuevo"
                  >
                    {(Object.keys(reformStatusLabels) as ReformStatus[]).map((value) => (
                      <option key={value} value={value}>{reformStatusLabels[value]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-md border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                    {reformStatusLabels[reform.status]}
                  </span>
                )}
              </div>
              <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-white md:text-4xl">{reform.title}</h1>
              {reform.description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{reform.description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/reforms/${reform.id}/export`}
                className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200"
              >
                <FileDown className="h-4 w-4" />
                Exportar código
              </a>
              {canEdit ? (
                <Link
                  href={`/normas/${reform.id}/nueva`}
                  className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nueva norma
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <MetricStrip
              items={[
                { label: "normas", value: reform.normCount },
                { label: "en borrador", value: reform.draftCount },
                { label: "en revisión", value: reform.inReviewCount },
                { label: "con conflictos", value: reform.conflictCount, tone: reform.conflictCount ? "warn" : "default" }
              ]}
            />
            <AuthorLine name={reform.authorName} />
          </div>
        </div>
      </section>

      <FilterBar>
        <FilterGroup label="Estado">
          <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")}>Todos</FilterChip>
          {normVisibleStatuses.map((value) => (
            <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
              {normStatusLabels[value]}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Materia">
          <FilterChip active={materia === "ALL"} onClick={() => setMateria("ALL")}>Todas</FilterChip>
          {(Object.keys(materiaLabels) as MunicipalArea[]).map((value) => (
            <FilterChip key={value} active={materia === value} onClick={() => setMateria(value)}>
              {materiaLabels[value]}
            </FilterChip>
          ))}
        </FilterGroup>
      </FilterBar>

      <section className="urban-card rounded-lg p-4 lg:p-5">
        {visible.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((norm) => (
              <NormCard key={norm.id} reformId={reform.id} norm={norm} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileStack}
            title={reform.norms.length ? "Ninguna norma coincide con los filtros" : "Este código todavía no tiene normas"}
            description={
              reform.norms.length
                ? "Ajustá o limpiá los filtros para ver el articulado completo."
                : "Cada norma es un artículo del código nuevo, redactado consultando el CPU 2014: se ancla el texto viejo, la IA detecta conflictos y el equipo redacta."
            }
            action={
              canEdit && !reform.norms.length ? (
                <Link
                  href={`/normas/${reform.id}/nueva`}
                  className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Redactar la primera norma
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function NormCard({ reformId, norm }: { reformId: string; norm: NormListItem }) {
  return (
    <Link href={`/normas/${reformId}/${norm.id}`} className="urban-lift block rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-slate-400">
          {norm.code}
          {norm.articleNumber ? ` · Art. ${norm.articleNumber}` : ""}
        </span>
        {norm.latestFeasibility ? (
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${conflictLevelStyles[norm.latestFeasibility]}`}>
            {conflictLevelLabels[norm.latestFeasibility]}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${normStatusStyles[norm.status]}`}>{normStatusLabels[norm.status]}</span>
        {norm.hasArticleText ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-slate-300">
            <FileText className="h-3 w-3" />
            Con articulado
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-base font-bold leading-6 text-white">{norm.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{norm.summary}</p>
      {norm.areas.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {norm.areas.slice(0, 4).map((areaCode) => (
            <span key={areaCode} className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">{materiaLabels[areaCode]}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Anchor className="h-3.5 w-3.5 text-[#1f89f6]" />
          {norm.anchorCount} {norm.anchorCount === 1 ? "artículo viejo relacionado" : "artículos viejos relacionados"}
        </span>
        {norm.opinionCount ? (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {norm.opinionCount}
          </span>
        ) : null}
        {norm.supportNet !== 0 ? (
          <span className={`inline-flex items-center gap-1.5 font-semibold ${norm.supportNet > 0 ? "text-sky-200" : "text-rose-200"}`}>
            {norm.supportNet > 0 ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
            {norm.supportNet > 0 ? `+${norm.supportNet}` : norm.supportNet}
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <AuthorLine name={norm.authorName} />
      </div>
    </Link>
  );
}

