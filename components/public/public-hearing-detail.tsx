"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { PortalFooter, PortalHeader, pageClass, usePortalTheme } from "@/components/public/portal-chrome";
import type { PublicHearingDetail } from "@/lib/hearings/public-shared";
import { publicHearingStatusLabels } from "@/lib/hearings/public-shared";

function formatDate(value: string | null) {
  if (!value) return "Fecha a confirmar";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

/** Detalle publico de una audiencia: lo que la Municipalidad publica del acta. */
export function PublicHearingDetailView({ hearing }: { hearing: PublicHearingDetail }) {
  const { isLight, toggleTheme } = usePortalTheme();
  const cardClass = isLight ? "border-slate-200/80 bg-white shadow-card" : "border-white/10 bg-[#0d1b2a]";
  const bodyClass = isLight ? "text-slate-600" : "text-slate-300";
  const hasActa = Boolean(hearing.summary || hearing.conclusions || hearing.agreements || hearing.nextSteps);

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="audiencias" />

      <div className="mx-auto max-w-4xl px-5 py-10">
        <Link
          href="/audiencias-publicas"
          className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
            isLight ? "text-slate-500 hover:text-sky-700" : "text-slate-400 hover:text-sky-200"
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a audiencias
        </Link>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#1f89f6]">Audiencia pública</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              isLight ? "border-slate-300 bg-slate-100 text-slate-600" : "border-white/15 bg-white/[0.06] text-slate-300"
            }`}>
              {publicHearingStatusLabels[hearing.status]}
            </span>
          </div>
          <h1 className={`mt-2 text-2xl font-black leading-tight md:text-3xl ${isLight ? "text-slate-900" : "text-white"}`}>
            {hearing.title}
          </h1>
          <p className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${bodyClass}`}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {formatDate(hearing.occurredAt)}
            </span>
            {hearing.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {hearing.location}
              </span>
            ) : null}
          </p>
        </header>

        {hearing.topic ? (
          <section className={`mt-6 rounded-2xl border p-5 ${cardClass}`}>
            <h2 className={`text-sm font-black ${isLight ? "text-slate-900" : "text-white"}`}>Tema principal</h2>
            <p className={`mt-2 text-sm leading-6 ${bodyClass}`}>{hearing.topic}</p>
          </section>
        ) : null}

        {hearing.topics.length > 0 ? (
          <section className={`mt-4 rounded-2xl border p-5 ${cardClass}`}>
            <h2 className={`text-sm font-black ${isLight ? "text-slate-900" : "text-white"}`}>Temas tratados</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {hearing.topics.map((topic) => (
                <li
                  key={topic}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    isLight ? "border-slate-200 bg-slate-50 text-slate-600" : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  {topic}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasActa ? (
          <>
            {hearing.summary ? (
              <Block title="Resumen de la audiencia" body={hearing.summary} cardClass={cardClass} bodyClass={bodyClass} isLight={isLight} />
            ) : null}
            {hearing.conclusions ? (
              <Block title="Conclusiones" body={hearing.conclusions} cardClass={cardClass} bodyClass={bodyClass} isLight={isLight} />
            ) : null}
            {hearing.agreements ? (
              <Block title="Acuerdos" body={hearing.agreements} cardClass={cardClass} bodyClass={bodyClass} isLight={isLight} />
            ) : null}
            {hearing.nextSteps ? (
              <Block title="Próximos pasos" body={hearing.nextSteps} cardClass={cardClass} bodyClass={bodyClass} isLight={isLight} />
            ) : null}
          </>
        ) : (
          <section className={`mt-6 rounded-2xl border p-5 ${cardClass}`}>
            <p className={`text-sm leading-6 ${bodyClass}`}>
              {hearing.status === "PROGRAMADA"
                ? "Esta audiencia todavía no se realizó. Cuando termine, acá vas a poder leer el resumen y las conclusiones."
                : "El acta de esta audiencia todavía está en elaboración. Cuando la Municipalidad la publique, vas a poder leerla acá."}
            </p>
          </section>
        )}

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}

function Block({
  title,
  body,
  cardClass,
  bodyClass,
  isLight
}: {
  title: string;
  body: string;
  cardClass: string;
  bodyClass: string;
  isLight: boolean;
}) {
  return (
    <section className={`mt-4 rounded-2xl border p-5 ${cardClass}`}>
      <h2 className={`text-sm font-black ${isLight ? "text-slate-900" : "text-white"}`}>{title}</h2>
      <p className={`mt-2 whitespace-pre-line text-sm leading-7 ${bodyClass}`}>{body}</p>
    </section>
  );
}
