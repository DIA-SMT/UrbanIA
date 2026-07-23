"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HearingStatus } from "@prisma/client";
import { Brain, Filter, Plus, Search, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { HearingCard } from "@/components/hearings/hearing-card";
import { hearingStatusLabels, hearingVisibleStatuses, type HearingCounts, type HearingListItem } from "@/lib/hearings/shared";

type StatusFilter = HearingStatus | "ALL";
type ReformFilter = string | "ALL";

type ReformOption = { id: string; code: string; title: string };

/**
 * Registro de audiencias publicas: primer pantallazo limpio y consultable, con
 * las audiencias persistidas y listadas por fecha. Espeja el board de la
 * Fabrica de Normas.
 */
export function HearingsBoard({
  hearings,
  counts,
  reforms,
  isLive,
  canCreate
}: {
  hearings: HearingListItem[];
  counts: HearingCounts;
  reforms: ReformOption[];
  isLive: boolean;
  canCreate: boolean;
}) {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [reformId, setReformId] = useState<ReformFilter>("ALL");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return hearings.filter(
      (hearing) =>
        (status === "ALL" || hearing.hearingStatus === status) &&
        (reformId === "ALL" || hearing.reformId === reformId) &&
        (normalizedQuery.length === 0 || hearing.title.toLowerCase().includes(normalizedQuery))
    );
  }, [hearings, status, reformId, query]);

  const usedReforms = useMemo(() => {
    const ids = new Set(hearings.map((hearing) => hearing.reformId).filter((id): id is string => Boolean(id)));
    return reforms.filter((reform) => ids.has(reform.id));
  }, [hearings, reforms]);

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
                <Brain className="h-4 w-4" />
                Memoria Pública Urbana
              </div>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-4xl">Audiencias Públicas</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Registro y consulta de las audiencias sobre el código nuevo: cada una queda persistida, con su cruce contra las mininormas de la Fábrica de Normas y su análisis. La IA orienta; el equipo valida.
              </p>
            </div>
            {canCreate ? (
              <div className="flex flex-wrap gap-2">
                <Link href="/audiencias/nueva" className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
                  <Plus className="h-4 w-4" />
                  Nueva audiencia
                </Link>
                <Link
                  href="/audiencias/cargar"
                  className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200"
                >
                  <Upload className="h-4 w-4" />
                  Cargar audiencia
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="Próximas" value={counts.upcoming} />
            <StatCard label="En procesamiento" value={counts.processing} />
            <StatCard label="Finalizadas" value={counts.completed} />
          </div>
        </div>
      </section>

      <section className="urban-card rounded-lg p-4 lg:p-5">
        <FilterRow label="Estado">
          <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")}>Todos</FilterChip>
          {hearingVisibleStatuses.map((value) => (
            <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
              {hearingStatusLabels[value]}
            </FilterChip>
          ))}
        </FilterRow>
        {usedReforms.length ? (
          <FilterRow label="Código nuevo">
            <FilterChip active={reformId === "ALL"} onClick={() => setReformId("ALL")}>Todos</FilterChip>
            {usedReforms.map((reform) => (
              <FilterChip key={reform.id} active={reformId === reform.id} onClick={() => setReformId(reform.id)}>
                {reform.code}
              </FilterChip>
            ))}
          </FilterRow>
        ) : null}
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título..."
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
        </label>
      </section>

      <section className="urban-card rounded-lg p-4 lg:p-5">
        {visible.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((hearing) => (
              <HearingCard key={hearing.id} hearing={hearing} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Brain}
            title={hearings.length ? "Ninguna audiencia coincide con los filtros" : isLive ? "Todavía no hay audiencias registradas" : "No pudimos conectar con la base de datos"}
            description={
              hearings.length
                ? "Ajustá o limpiá los filtros para ver el registro completo."
                : isLive
                  ? "Registrá la primera audiencia o cargá una grabada para empezar a construir la memoria pública."
                  : "El registro de audiencias necesita conexión a la base para listar y persistir."
            }
            action={
              canCreate && isLive && !hearings.length ? (
                <Link href="/audiencias/nueva" className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white">
                  <Plus className="h-4 w-4" />
                  Nueva audiencia
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Filter className="h-3 w-3" />
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
        active ? "bg-civic-blue text-white" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
