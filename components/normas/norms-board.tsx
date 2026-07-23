"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MunicipalArea, ProjectStatus, ReformStatus } from "@prisma/client";
import { Anchor, ArrowLeft, FileDown, FileStack, FileText, MessageSquare, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthorLine, FilterBar, FilterChip, FilterGroup, MetricStrip } from "@/components/ui/board-ui";
import { SupportControls } from "@/components/normas/support-controls";
import { ActiveVoterBar } from "@/components/normas/active-voter";
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
export function NormsBoard({
  reform,
  canEdit,
  knownAuthors = []
}: {
  reform: ReformDetail;
  canEdit: boolean;
  /** Alimenta el selector de identidad: sin nombre elegido no se puede votar. */
  knownAuthors?: string[];
}) {
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
            <AuthorLine name={reform.authorName} account={reform.authorAccount} />
          </div>
        </div>
      </section>

      {canEdit ? <ActiveVoterBar knownAuthors={knownAuthors} /> : null}

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
              <NormCard key={norm.id} reformId={reform.id} norm={norm} canEdit={canEdit} />
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

/**
 * Card de una norma. El cuerpo navega al detalle, pero el pie NO: ahi viven los
 * botones de apoyo y el acceso a las devoluciones, y por eso la card dejo de ser
 * un unico <Link> envolvente (no se pueden anidar botones dentro de un link).
 */
function NormCard({ reformId, norm, canEdit }: { reformId: string; norm: NormListItem; canEdit: boolean }) {
  return (
    <div className="urban-lift flex flex-col rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <Link href={`/normas/${reformId}/${norm.id}`} className="block">
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
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Anchor className="h-3.5 w-3.5 text-[#1f89f6]" />
          {norm.anchorCount} {norm.anchorCount === 1 ? "artículo viejo relacionado" : "artículos viejos relacionados"}
        </span>
      </div>
      </Link>

      {/* Fuera del Link: son acciones, no navegación. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
        <SupportControls
          normId={norm.id}
          canVote={canEdit}
          size="sm"
          initial={{
            supportCount: norm.supportCount,
            objectionCount: norm.objectionCount,
            net: norm.supportNet,
            voters: norm.voters
          }}
        />
        {/* Burbuja: se lee como "hay conversacion acá", no como un boton mas. */}
        <Link
          href={`/normas/${reformId}/${norm.id}#opiniones`}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
            norm.opinionCount
              ? "border-civic-blue/35 bg-civic-blue/10 text-sky-200 hover:border-civic-blue/60 hover:bg-civic-blue/[0.16]"
              : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-civic-blue/35 hover:bg-civic-blue/[0.07] hover:text-sky-200"
          }`}
        >
          <MessageSquare className={`h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-px ${norm.opinionCount ? "fill-civic-blue/20" : ""}`} />
          {norm.opinionCount ? `${norm.opinionCount} ${norm.opinionCount === 1 ? "devolución" : "devoluciones"}` : "Opinar"}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <AuthorLine name={norm.authorName} account={norm.authorAccount} />
        <span className="text-xs text-slate-500">
          Últ. actualización{" "}
          {new Date(norm.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}

