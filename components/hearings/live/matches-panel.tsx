"use client";

import { useMemo } from "react";
import { ExternalLink, Scale, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { stanceLabels, stanceStyles, type HearingMatchView } from "@/lib/hearings/shared";

function formatAtMs(atMs: number | null): string {
  if (atMs === null) return "";
  const totalSeconds = Math.floor(atMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type NormGroup = {
  normId: string;
  code: string;
  title: string;
  articleNumber: string | null;
  latestAt: string;
  matches: HearingMatchView[];
};

/**
 * Panel de cruces en vivo: que mininormas del codigo nuevo se estan tocando en
 * el debate, con postura, confianza y el fragmento que lo disparo. Sugerencias
 * de Migue para el equipo; no deciden nada.
 */
export function MatchesPanel({
  matches,
  reformId,
  aiAvailable
}: {
  matches: HearingMatchView[];
  reformId: string | null;
  aiAvailable: boolean;
}) {
  const groups = useMemo<NormGroup[]>(() => {
    const byNorm = new Map<string, NormGroup>();
    for (const match of matches) {
      const existing = byNorm.get(match.normId);
      if (existing) {
        existing.matches.push(match);
        if (match.createdAt > existing.latestAt) existing.latestAt = match.createdAt;
      } else {
        byNorm.set(match.normId, {
          normId: match.normId,
          code: match.code,
          title: match.title,
          articleNumber: match.articleNumber,
          latestAt: match.createdAt,
          matches: [match]
        });
      }
    }
    const list = [...byNorm.values()];
    list.forEach((group) => group.matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    list.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return list;
  }, [matches]);

  return (
    <section className="urban-card flex min-h-[60vh] flex-col rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-300">
          <Sparkles className="h-4 w-4 text-[#1f89f6]" />
          Cruce con el código nuevo
        </p>
        <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-black text-sky-200">
          {groups.length} {groups.length === 1 ? "norma tocada" : "normas tocadas"}
        </span>
      </div>

      {!reformId ? (
        <p className="mb-3 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-bold leading-5 text-sky-100">
          Esta audiencia tiene un tema libre, sin código nuevo asociado. El cruce automático con las normas está desactivado.
        </p>
      ) : !aiAvailable ? (
        <p className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          El servicio de IA no está configurado: la transcripción funciona, pero el cruce con las normas está desactivado.
        </p>
      ) : null}

      {groups.length ? (
        <div className="urban-scrollbar grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {groups.map((group) => (
            <a
              key={group.normId}
              href={`/normas/${reformId}/${group.normId}`}
              target="_blank"
              rel="noreferrer"
              className="urban-lift block rounded-lg border border-white/8 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  {group.code}
                  {group.articleNumber ? ` · Art. ${group.articleNumber}` : ""}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              </div>
              <h3 className="mt-1 text-sm font-black leading-5 text-white">{group.title}</h3>
              <div className="mt-2 grid gap-2">
                {group.matches.map((match) => (
                  <div key={match.id} className="rounded-md border border-white/8 bg-slate-950/40 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${stanceStyles[match.stance]}`}>
                        {stanceLabels[match.stance]}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Confianza {Math.round(match.confidence * 100)}%
                        {match.atMs !== null ? ` · ${formatAtMs(match.atMs)}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 border-l-2 border-[#f6d500] pl-2 text-xs italic leading-5 text-slate-300">
                      “{match.fragment}”
                    </p>
                  </div>
                ))}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center">
          <EmptyState
            icon={Scale}
            title="Sin cruces todavía"
            description="Cuando el debate toque una mininorma del código nuevo, va a aparecer acá con su postura y el fragmento que la disparó."
          />
        </div>
      )}
    </section>
  );
}
