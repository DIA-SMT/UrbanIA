"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, Landmark, MessageSquare, Search, UserRound } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import {
  PortalFooter,
  PortalHeader,
  eyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  usePortalTheme
} from "@/components/public/portal-chrome";

type LandingProps = {
  /** Del CPU real, no hardcodeado: se muestran en la card de consulta. */
  chapterCount: number;
  articleCount: number;
};

/**
 * La landing es un hub, no un catálogo: hero y dos puertas de entrada. Antes tenía
 * la biblioteca, el formulario y la bandeja de aportes apilados en un scroll largo,
 * y el vecino veía todo junto sin saber por dónde empezar. Cada camino ahora tiene
 * su pantalla: /codigo y /presentar.
 */
export function CitizenPortalLanding({ chapterCount, articleCount }: LandingProps) {
  const { isLight, toggleTheme } = usePortalTheme();

  return (
    // Sin fondo propio (a diferencia de pageClass): el video fijo de abajo es el
    // fondo de TODA la pagina y el contenido scrollea por encima.
    <main className={`min-h-screen ${isLight ? "text-slate-900" : "text-slate-100"}`}>
      {/* Fondo fijo: ciudad 3D en video. No acompana el scroll. Hay dos
          versiones del mismo video: la original azul oscura para el tema oscuro
          y una celeste (invertida con ffmpeg) para el claro, asi ninguno va
          tapado por un velo. Solo queda un tinte/resplandor suave para que el
          texto respire. La key remonta el <video> al cambiar de tema. Con
          reduced-motion el video se oculta y queda el color plano. */}
      <div aria-hidden className={`fixed inset-0 -z-10 ${isLight ? "bg-[#f8fbff]" : "bg-[#06121f]"}`}>
        <video
          key={isLight ? "clara" : "oscura"}
          src={isLight ? "/media/ola-ciudad-clara.mp4" : "/media/ola-ciudad.mp4"}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover motion-reduce:hidden"
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? "bg-[radial-gradient(66%_54%_at_50%_38%,rgba(248,251,255,0.70),transparent_78%)]"
              : "bg-[#06121f]/35"
          }`}
        />
      </div>

      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="inicio" />

      <section className={`relative isolate overflow-hidden border-b ${isLight ? "border-slate-200/70" : "border-white/10"}`}>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 ${
            isLight
              ? "bg-[radial-gradient(70%_60%_at_15%_0%,rgba(31,137,246,0.10),transparent_60%),radial-gradient(50%_50%_at_95%_10%,rgba(53,174,234,0.10),transparent_65%)]"
              : "bg-[radial-gradient(70%_60%_at_15%_0%,rgba(31,137,246,0.18),transparent_60%),radial-gradient(50%_50%_at_95%_10%,rgba(53,174,234,0.10),transparent_65%)]"
          }`}
        />
        <div className="mx-auto flex min-h-[72svh] max-w-6xl flex-col items-center justify-center px-5 py-16 text-center md:py-20">
          <div className={eyebrowClass(isLight)}>
            <Landmark className="h-3.5 w-3.5" />
            Direccion de Inteligencia Artificial
          </div>

          <h1 className="mt-7 font-display tracking-[-0.03em]">
            <span className={`block text-[2.5rem] font-extrabold leading-[1] sm:text-[3.25rem] ${isLight ? "text-slate-900" : "text-white"}`}>
              Visualizador del
            </span>
            <span
              className={`mx-auto mt-1.5 block max-w-[15ch] text-[2.75rem] font-black leading-[0.94] sm:text-[3.75rem] lg:text-[4.25rem] ${
                isLight ? "text-civic-blue-deep" : "text-civic-sky"
              }`}
            >
              Codigo de Planeamiento Urbano
            </span>
          </h1>

          {/* slate-700 y no 600: sobre el video el gris medio se perdia. */}
          <p className={`mt-7 max-w-xl text-base leading-7 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
            Consulta la normativa urbana de la ciudad y presenta tus propuestas o reclamos para mejorar tu barrio.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/codigo" className={primaryButtonClass()}>
              <Search className="h-4 w-4" />
              Explorar el codigo
            </Link>
            <Link href="/presentar" className={secondaryButtonClass(isLight)}>
              <UserRound className="h-4 w-4" />
              Presentar un aporte
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5">
        <section className="relative z-10 -mt-12 grid gap-4 md:grid-cols-2">
          <EntryCard
            href="/codigo"
            icon={BookOpenCheck}
            eyebrow="Consultar"
            title="El Codigo de Planeamiento"
            detail={`${chapterCount} capitulos y ${articleCount} articulos: zonificacion, usos del suelo, alturas y retiros. Buscá un tema y lee el texto completo.`}
            cta="Explorar el codigo"
            isLight={isLight}
          />
          <EntryCard
            href="/presentar"
            icon={UserRound}
            eyebrow="Participar"
            title="Presentar propuesta o reclamo"
            detail="Contanos con tus palabras que te gustaria que la ciudad regule, cambie o mejore. Necesitas una cuenta de vecino."
            cta="Dejar mi aporte"
            isLight={isLight}
          />
        </section>

        <section className={`mt-16 rounded-2xl border p-6 md:p-8 ${isLight ? "border-slate-200/80 bg-white shadow-card" : "border-white/10 bg-[#0d1b2a]"}`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className={eyebrowClass(isLight)}>
                <MessageSquare className="h-3.5 w-3.5" />
                Asistente urbano
              </div>
              <h2 className={`mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] ${isLight ? "text-slate-900" : "text-white"}`}>
                Preguntale a Migue
              </h2>
              <p className={`mt-3 text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Escribile como hablas. Te responde sobre el Codigo citando el articulo en el que se apoya, asi podes verificarlo vos mismo.
              </p>
            </div>
            <p className={`shrink-0 text-xs leading-5 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
              Abrilo con el boton
              <br />
              de abajo a la derecha
            </p>
          </div>
        </section>

        <PortalFooter isLight={isLight} />
      </div>

      <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
    </main>
  );
}

function EntryCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  detail,
  cta,
  isLight
}: {
  href: string;
  icon: typeof Search;
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  isLight: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-6 transition duration-200 ${
        isLight
          ? "border-slate-200/80 bg-white shadow-card hover:border-slate-300 hover:shadow-card-hover"
          : "border-white/10 bg-[#0d1b2a] hover:border-sky-300/25"
      }`}
    >
      <div className={isLight ? "grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-civic-blue-deep" : "grid h-11 w-11 place-items-center rounded-xl bg-sky-300/10 text-sky-200"}>
        <Icon className="h-5 w-5" />
      </div>
      <p className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-1.5 font-display text-xl font-extrabold tracking-[-0.02em] ${isLight ? "text-slate-900" : "text-white"}`}>
        {title}
      </h2>
      <p className={`mt-3 text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{detail}</p>
      <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`}>
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
