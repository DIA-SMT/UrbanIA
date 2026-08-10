"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, MapPin } from "lucide-react";
import { PortalFooter, PortalHeader, pageClass, usePortalTheme } from "@/components/public/portal-chrome";
import type { PublicHearingListItem } from "@/lib/hearings/public-shared";
import { publicHearingStatusLabels } from "@/lib/hearings/public-shared";

const statusClasses: Record<string, string> = {
  PROGRAMADA: "border-sky-300 bg-sky-50 text-sky-700",
  REALIZADA: "border-emerald-300 bg-emerald-50 text-emerald-700",
  CANCELADA: "border-slate-300 bg-slate-100 text-slate-600"
};

function formatDate(value: string | null) {
  if (!value) return "Fecha a confirmar";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

/**
 * Registro publico de audiencias, dentro del portal ciudadano. Los datos vienen
 * de lib/hearings/public-data (vista recortada): nunca participantes ni
 * transcripciones.
 */
export function PublicHearings({ hearings }: { hearings: PublicHearingListItem[] }) {
  const { isLight, toggleTheme } = usePortalTheme();
  const proximas = hearings.filter((hearing) => hearing.status === "PROGRAMADA");
  const pasadas = hearings.filter((hearing) => hearing.status !== "PROGRAMADA");

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="audiencias" />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <Link
          href="/"
          className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
            isLight ? "text-slate-500 hover:text-sky-700" : "text-slate-400 hover:text-sky-200"
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al portal
        </Link>

        <header className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f89f6]">Participación</p>
          <h1 className={`mt-1 text-2xl font-black leading-tight md:text-3xl ${isLight ? "text-slate-900" : "text-white"}`}>
            Audiencias públicas
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
            La memoria pública del debate sobre las normas de la ciudad. Cada audiencia queda registrada con su fecha, los
            temas que se trataron y las conclusiones a las que se llegó.
          </p>
        </header>

        {hearings.length === 0 ? (
          <section
            className={`mt-8 rounded-2xl border p-10 text-center ${
              isLight ? "border-slate-200/80 bg-white" : "border-white/10 bg-[#0d1b2a]"
            }`}
          >
            <CalendarDays className={`mx-auto h-8 w-8 ${isLight ? "text-slate-300" : "text-slate-600"}`} aria-hidden />
            <p className={`mt-3 text-sm font-bold ${isLight ? "text-slate-600" : "text-slate-300"}`}>
              Todavía no hay audiencias publicadas
            </p>
            <p className={`mt-1 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Cuando se convoque la próxima, la vas a encontrar acá con su fecha y su lugar.
            </p>
          </section>
        ) : (
          <>
            {proximas.length > 0 ? (
              <section className="mt-8">
                <h2 className={`text-sm font-black uppercase tracking-wide ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Próximas
                </h2>
                <div className="mt-3 grid gap-3">
                  {proximas.map((hearing) => (
                    <HearingRow key={hearing.id} hearing={hearing} isLight={isLight} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8">
              <h2 className={`text-sm font-black uppercase tracking-wide ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Realizadas
              </h2>
              <div className="mt-3 grid gap-3">
                {pasadas.map((hearing) => (
                  <HearingRow key={hearing.id} hearing={hearing} isLight={isLight} />
                ))}
              </div>
            </section>
          </>
        )}

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}

function HearingRow({ hearing, isLight }: { hearing: PublicHearingListItem; isLight: boolean }) {
  return (
    <Link
      href={`/audiencias-publicas/${hearing.id}`}
      className={`group flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition ${
        isLight
          ? "border-slate-200/80 bg-white shadow-card hover:border-sky-300 hover:shadow-card-hover"
          : "border-white/10 bg-[#0d1b2a] hover:border-sky-400/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-base font-black ${isLight ? "text-slate-900" : "text-white"}`}>{hearing.title}</p>
        <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatDate(hearing.occurredAt)}
          </span>
          {hearing.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {hearing.location}
            </span>
          ) : null}
          {hearing.hasRecord ? (
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Con acta publicada
            </span>
          ) : null}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClasses[hearing.status]}`}
      >
        {publicHearingStatusLabels[hearing.status]}
      </span>
    </Link>
  );
}
