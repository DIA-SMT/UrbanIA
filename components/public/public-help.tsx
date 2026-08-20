"use client";

import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { citizenTools } from "@/components/help/help-content";
import { ToolGuideDeck } from "@/components/help/tool-guide-deck";
import { PortalFooter, PortalHeader, pageClass, usePortalTheme } from "@/components/public/portal-chrome";

/**
 * Centro de ayuda del PORTAL CIUDADANO. Vive dentro del chrome del portal (no
 * del AppShell interno) por dos razones: el vecino no tiene por qué salir del
 * portal para leer una guía, y el armazón interno expone la navegación del
 * sistema municipal a cualquiera que entre.
 *
 * Solo importa `citizenTools`: el manual del equipo está en otro módulo, que
 * únicamente carga /admin/ayuda.
 */
export function PublicHelp() {
  const { isLight, toggleTheme } = usePortalTheme();

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="ayuda" />

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
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f89f6]">Centro de ayuda</p>
          <h1 className={`mt-1 text-2xl font-black leading-tight md:text-3xl ${isLight ? "text-slate-900" : "text-white"}`}>
            Cómo usar el portal
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
            UrbanIA es la plataforma de la Municipalidad de San Miguel de Tucumán para trabajar la normativa urbana con
            participación ciudadana. Acá tenés, paso a paso, todo lo que podés hacer desde el portal: leer el Código,
            preguntarle a Migue, presentar propuestas y seguir las audiencias públicas.
          </p>
        </header>

        <section aria-label="Guías del portal ciudadano" className="mt-8">
          <p className={`mb-3 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
            Tocá una herramienta para ver el paso a paso.
          </p>
          <ToolGuideDeck tools={citizenTools} />
        </section>

        <section
          className={`mt-10 rounded-2xl border p-6 ${
            isLight ? "border-slate-200/80 bg-white shadow-card" : "border-white/10 bg-[#0d1b2a]"
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className={`text-base font-black ${isLight ? "text-slate-900" : "text-white"}`}>
                ¿Trabajás en la Municipalidad?
              </h2>
              <p className={`mt-1 max-w-2xl text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                Las herramientas de gestión interna se usan con una cuenta municipal y su guía está dentro del sistema.
                Ingresá con Cidituc para acceder.
              </p>
            </div>
            <Link
              href="/ingresar"
              className="urban-button inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#1f89f6] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)] hover:bg-[#087bec]"
            >
              <KeyRound className="h-4 w-4" />
              Ingresar
            </Link>
          </div>
        </section>

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}
