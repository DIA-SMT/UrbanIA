"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, KeyRound, UserRound } from "lucide-react";

import { citizenTools, staffTools } from "@/components/help/help-content";
import { ToolGuideCard } from "@/components/help/tool-guide-card";

type Audience = "vecinos" | "equipo";

/**
 * Centro de ayuda con dos audiencias: vecinos y equipo municipal. El gating es
 * el REAL de la app: la seccion del equipo se puede leer siempre (es
 * documentacion, no datos), pero si no hay sesion municipal un aviso aclara
 * que esas herramientas piden cuenta municipal, en vez de dejar que alguien
 * choque contra el login sin entender por que.
 */
export function HelpCenter({ isStaffSession }: { isStaffSession: boolean }) {
  // El equipo cae directo en su seccion; el resto, en la de vecinos.
  const [audience, setAudience] = useState<Audience>(isStaffSession ? "equipo" : "vecinos");

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
      active
        ? "bg-[#1f89f6] text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f89f6]">Centro de ayuda</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-slate-900 dark:text-white md:text-3xl">
          Cómo usar UrbanIA
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          UrbanIA es la plataforma de la Municipalidad de San Miguel de Tucumán para trabajar la normativa urbana con
          participación ciudadana. Esta guía explica cada herramienta paso a paso, según cómo la uses.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Elegí tu perfil"
        className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#0d1b2a]"
      >
        <button
          role="tab"
          aria-selected={audience === "vecinos"}
          onClick={() => setAudience("vecinos")}
          className={tabClass(audience === "vecinos")}
        >
          <UserRound className="h-4 w-4" />
          Para vecinos
        </button>
        <button
          role="tab"
          aria-selected={audience === "equipo"}
          onClick={() => setAudience("equipo")}
          className={tabClass(audience === "equipo")}
        >
          <Building2 className="h-4 w-4" />
          Para el equipo municipal
        </button>
      </div>

      {audience === "vecinos" ? (
        <section aria-label="Guías para vecinos" className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Esto es lo que podés hacer como vecino o vecina: leer el Código, preguntarle a la IA de la ciudad, presentar
            propuestas y seguir las audiencias públicas.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {citizenTools.map((tool) => (
              <ToolGuideCard key={tool.name} tool={tool} />
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="Guías para el equipo municipal" className="space-y-4">
          {!isStaffSession ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 dark:border-amber-300/25">
              <p className="text-sm font-bold leading-6 text-amber-800 dark:text-amber-100">
                Estas herramientas requieren una cuenta municipal (la asigna Administración). Podés leer las guías
                igual, pero para usarlas necesitás ingresar con esa cuenta.
              </p>
              <Link
                href="/ingresar"
                className="urban-button inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-bold text-amber-800 dark:text-amber-100"
              >
                <KeyRound className="h-4 w-4" />
                Ingresar
              </Link>
            </div>
          ) : (
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Manual operativo del gabinete: el circuito completo va de los aportes ciudadanos a la Fábrica de Normas,
              con las audiencias públicas como registro del debate y Migue como apoyo transversal.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {staffTools.map((tool) => (
              <ToolGuideCard key={tool.name} tool={tool} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
