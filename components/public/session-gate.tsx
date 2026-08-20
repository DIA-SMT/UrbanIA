"use client";

import Link from "next/link";
import { BookOpenCheck, Landmark, MessageSquarePlus, ShieldCheck, UserRound } from "lucide-react";
import {
  PortalFooter,
  PortalHeader,
  eyebrowClass,
  pageClass,
  panelClass,
  primaryButtonClass,
  usePortalTheme
} from "@/components/public/portal-chrome";

/**
 * Pantalla que ve alguien SIN sesión cuando entra a una sección del portal que
 * ahora la exige (el Código, las audiencias, presentar un aporte).
 *
 * No es un redirect a /ingresar a propósito: un enlace compartido por WhatsApp
 * terminaría en una puerta muda, sin que la persona sepa qué había del otro
 * lado ni por qué le piden una cuenta. Acá ve el nombre de la sección, qué
 * contiene y el botón de Cidituc.
 *
 * Conserva el encabezado y el pie del portal: la persona sigue pudiendo llegar
 * a la portada y a Ayuda, que son las dos cosas que quedan abiertas.
 */
/**
 * El icono se elige por NOMBRE y no se recibe como componente: quien usa esta
 * pantalla es un server component, y React no puede serializar una función al
 * cruzar al cliente ("Functions cannot be passed directly to Client
 * Components"). Pasar `icon={BookOpenCheck}` compila y revienta en runtime.
 */
const ICONOS = {
  codigo: BookOpenCheck,
  audiencias: Landmark,
  sugerencias: MessageSquarePlus
} as const;

export function SessionGate({
  seccion,
  eyebrow,
  title,
  detail,
  active
}: {
  seccion: keyof typeof ICONOS;
  eyebrow: string;
  title: string;
  /** Qué va a encontrar del otro lado. Concreto: es lo que decide si crea la cuenta. */
  detail: string;
  active?: "codigo" | "presentar" | "audiencias" | "sugerencias";
}) {
  const { isLight, toggleTheme } = usePortalTheme();
  const Icon = ICONOS[seccion];

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active={active} />

      <div className="mx-auto max-w-3xl px-5 py-14 md:py-20">
        <div className={`${panelClass(isLight)} text-center`}>
          <div
            className={
              isLight
                ? "mx-auto grid h-12 w-12 place-items-center rounded-xl bg-sky-50 text-civic-blue-deep"
                : "mx-auto grid h-12 w-12 place-items-center rounded-xl bg-sky-300/10 text-sky-200"
            }
          >
            <Icon className="h-6 w-6" />
          </div>

          <div className="mt-4 flex justify-center">
            <span className={eyebrowClass(isLight)}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {eyebrow}
            </span>
          </div>

          <h1
            className={`mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {title}
          </h1>

          <p className={`mx-auto mt-3 max-w-xl text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            {detail}
          </p>

          <p className={`mx-auto mt-4 max-w-xl text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Para verlo necesitás ingresar con <strong className={isLight ? "text-slate-900" : "text-white"}>Ciudadano
            Digital (Cidituc)</strong>, la cuenta única de la Municipalidad. Si nunca entraste, UrbanIA te crea la
            cuenta ciudadana sola en el primer acceso: no hay que registrarse aparte ni elegir otra contraseña.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/ingresar" className={primaryButtonClass()}>
              <UserRound className="h-4 w-4" />
              Ingresar con Cidituc
            </Link>
            <Link
              href="/ayuda"
              className={`text-sm font-bold ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`}
            >
              Ver qué se puede hacer en el portal
            </Link>
          </div>
        </div>

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}
