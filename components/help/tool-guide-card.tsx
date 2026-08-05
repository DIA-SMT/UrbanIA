import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

import type { ToolGuide } from "@/components/help/help-content";

/**
 * Tarjeta de una herramienta en el centro de ayuda: que es, para que sirve,
 * pasos numerados y el link directo. Presentacional pura; el contenido vive en
 * help-content.ts. Estilada para los DOS temas (claro y oscuro), siguiendo las
 * clases duales del shell.
 */
export function ToolGuideCard({ tool }: { tool: ToolGuide }) {
  const Icon = tool.icon;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300/70 hover:shadow-md dark:border-white/10 dark:bg-[#0d1b2a] dark:hover:border-sky-300/40">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1f89f6]/10 text-[#1f89f6] dark:bg-[#1f89f6]/15">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-black leading-tight text-slate-900 dark:text-white">{tool.name}</h3>
          <p className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{tool.oneLiner}</p>
        </div>
      </header>

      {tool.access ? (
        <p
          className={`mt-3 inline-flex w-fit items-center rounded-md border px-2 py-1 text-[11px] font-bold ${
            tool.access.tone === "warn"
              ? "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-300/25 dark:text-amber-200"
              : "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:border-sky-300/25 dark:text-sky-200"
          }`}
        >
          {tool.access.label}
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{tool.paraQue}</p>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Cómo usarla</p>
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

      {/* El CTA queda abajo aunque el contenido varie: la card es una columna flex. */}
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
    </article>
  );
}
