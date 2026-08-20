"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ChevronDown, Lightbulb } from "lucide-react";
import type { ToolGuide } from "@/components/help/help-content";

/**
 * Centro de ayuda del portal ciudadano: una grilla de tarjetas compactas que se
 * abren de a una.
 *
 * Antes las cinco guias se mostraban enteras al mismo tiempo --el para que, los
 * pasos numerados y los avisos, todo desplegado-- y la pantalla era un muro de
 * texto donde no se distinguia una herramienta de otra. Ahora la grilla se lee
 * de un vistazo (icono, nombre y una linea) y el detalle aparece solo cuando
 * alguien lo pide.
 *
 * Se abre UNA sola a la vez a proposito: con varias abiertas vuelve el muro,
 * que es justo lo que se venia a resolver.
 *
 * Es un componente aparte y NO un cambio a ToolGuideCard porque esa tarjeta la
 * comparte el manual interno (/admin/ayuda), donde tener todo desplegado sirve:
 * el equipo lo usa como referencia y busca con Ctrl+F.
 */
export function ToolGuideDeck({ tools }: { tools: ToolGuide[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const baseId = useId();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const estaAbierta = abierta === tool.name;
        const panelId = `${baseId}-${tool.name.replace(/\W+/g, "-")}`;

        return (
          <article
            key={tool.name}
            className={`flex h-full flex-col rounded-xl border bg-white transition dark:bg-[#0d1b2a] ${
              estaAbierta
                ? "border-sky-300 shadow-md dark:border-sky-300/40"
                : "border-slate-200 shadow-sm hover:border-sky-300/70 hover:shadow-md dark:border-white/10 dark:hover:border-sky-300/40"
            }`}
          >
            {/* Un <button> de verdad y no un div con onClick: sin esto la tarjeta
                no se abre con teclado ni la anuncia un lector de pantalla. */}
            <button
              type="button"
              onClick={() => setAbierta(estaAbierta ? null : tool.name)}
              aria-expanded={estaAbierta}
              aria-controls={panelId}
              className="flex w-full items-start gap-3 rounded-xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0d1b2a]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1f89f6]/10 text-[#1f89f6] dark:bg-[#1f89f6]/15">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black leading-tight text-slate-900 dark:text-white">
                  {tool.name}
                </span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-500 dark:text-slate-400">
                  {tool.oneLiner}
                </span>
                {tool.access ? (
                  <span
                    className={`mt-2 inline-flex w-fit items-center rounded-md border px-2 py-1 text-[11px] font-bold ${
                      tool.access.tone === "warn"
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-300/25 dark:text-amber-200"
                        : "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:border-sky-300/25 dark:text-sky-200"
                    }`}
                  >
                    {tool.access.label}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                aria-hidden
                className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
                  estaAbierta ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Se monta solo al abrir: el texto cerrado no tiene por que estar en
                el DOM, y asi el buscador del navegador no encuentra pasos que la
                persona no esta viendo. */}
            {estaAbierta ? (
              <div id={panelId} className="flex flex-1 flex-col border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/5">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{tool.paraQue}</p>

                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Cómo usarla
                  </p>
                  <ol className="mt-2 space-y-2">
                    {tool.pasos.map((paso, index) => (
                      <li key={index} className="flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                          {index + 1}
                        </span>
                        <span>{paso}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {tool.tips?.length ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Lightbulb className="h-3.5 w-3.5 text-[#f6d500]" />
                      Para tener en cuenta
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {tool.tips.map((tip, index) => (
                        <li key={index} className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-auto pt-4">
                  {tool.href ? (
                    <Link
                      href={tool.href}
                      className="urban-button inline-flex items-center gap-2 rounded-lg bg-[#1f89f6] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0066ff]"
                    >
                      {tool.ctaLabel ?? "Ir a la herramienta"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      Está siempre visible: buscá la burbuja en la esquina de la pantalla.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
