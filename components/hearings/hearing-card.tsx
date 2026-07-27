"use client";

import Link from "next/link";
import { Anchor, CalendarDays, MapPin, MessageSquareText, Scale, TriangleAlert, Users } from "lucide-react";
import { hearingStatusLabels, hearingStatusStyles, type HearingListItem } from "@/lib/hearings/shared";

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Card de una audiencia en el listado del registro. */
export function HearingCard({ hearing }: { hearing: HearingListItem }) {
  return (
    <Link href={`/audiencias/${hearing.id}`} className="urban-lift block rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(hearing.occurredAt)}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${hearingStatusStyles[hearing.hearingStatus]}`}>
          {hearingStatusLabels[hearing.hearingStatus]}
        </span>
      </div>

      <h3 className="mt-3 text-base font-black leading-6 text-white">{hearing.title}</h3>

      {hearing.ingestError || hearing.ingestStalled ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[11px] font-bold text-amber-100">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {hearing.ingestError ? "El procesamiento falló" : "El procesamiento se interrumpió"}
        </p>
      ) : null}

      {hearing.reformCode ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Scale className="h-3.5 w-3.5 text-[#1f89f6]" />
          <span className="truncate">
            {hearing.reformCode}
            {hearing.reformTitle ? ` · ${hearing.reformTitle}` : ""}
          </span>
        </p>
      ) : hearing.topic ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <MessageSquareText className="h-3.5 w-3.5 text-[#1f89f6]" />
          <span className="truncate">{hearing.topic}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Anchor className="h-3.5 w-3.5 text-[#1f89f6]" />
          {hearing.matchCount} {hearing.matchCount === 1 ? "macheo" : "macheos"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[#1f89f6]" />
          {hearing.participantCount} {hearing.participantCount === 1 ? "participante" : "participantes"}
        </span>
        {hearing.location ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#1f89f6]" />
            <span className="truncate">{hearing.location}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
