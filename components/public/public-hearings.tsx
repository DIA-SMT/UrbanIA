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
            temas que se trataron y el resumen ejecutivo en PDF que publica la Municipalidad.
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
    <article
      className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${
        isLight ? "border-slate-200/80 bg-white shadow-card" : "border-white/10 bg-[#0d1b2a]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className={`text-base font-black ${isLight ? "text-slate-900" : "text-white"}`}>{hearing.title}</h3>
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
        </p>
        {hearing.topic ? (
          <p className={`mt-1.5 text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-300"}`}>{hearing.topic}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClasses[hearing.status]}`}>
          {publicHearingStatusLabels[hearing.status]}
        </span>
        {hearing.summaryUrl ? (
          <a
            href={hearing.summaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="urban-button inline-flex items-center gap-2 rounded-xl bg-[#1f89f6] px-3.5 py-2 text-xs font-bold text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)] hover:bg-[#087bec]"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Resumen (PDF)
          </a>
        ) : (
          <span className={`text-xs font-semibold ${isLight ? "text-slate-400" : "text-slate-500"}`}>
            Resumen en elaboración
          </span>
        )}
      </div>
    </article>
  );
}
