"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, FileSearch, GitBranch, Landmark, MessageSquareText, Route, Users } from "lucide-react";

const stages = [
  { label: "Propuestas", meta: "12 activas", detail: "Iniciativas ciudadanas, técnicas y de gabinete.", icon: Route },
  { label: "Análisis normativo", meta: "4 en revisión", detail: "Compatibilidad preliminar con el Código de Planeamiento.", icon: FileSearch },
  { label: "Audiencias", meta: "3 programadas", detail: "Instancias públicas vinculadas a expedientes y proyectos.", icon: MessageSquareText },
  { label: "Participación", meta: "86 aportes", detail: "Evidencia ciudadana organizada por territorio y tema.", icon: Users },
  { label: "Escenarios", meta: "5 en evaluación", detail: "Alternativas comparadas con evidencia disponible.", icon: GitBranch },
  { label: "Decisión", meta: "2 pendientes", detail: "Resoluciones que requieren preparación para gabinete.", icon: Landmark },
  { label: "Seguimiento", meta: "7 activos", detail: "Compromisos, responsables y próximos hitos.", icon: CheckCircle2 }
];

export function TraceabilityFlow() {
  const [active, setActive] = useState(0);

  return (
    <section className="surface-panel overflow-hidden p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Trazabilidad urbana</p><h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">De la propuesta a la decisión</h2></div>
        <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">Cada etapa conserva la evidencia, los actores y las decisiones que explican cómo avanza una iniciativa.</p>
      </div>
      <div className="urban-scrollbar mt-7 overflow-x-auto pb-3">
        <div className="relative grid min-w-[980px] grid-cols-7 gap-3">
          <div className="absolute left-[7%] right-[7%] top-6 h-px bg-slate-200 dark:bg-white/10" />
          <motion.div className="absolute left-[7%] top-6 h-px bg-[#1f89f6]" animate={{ width: `${active * 14.3}%` }} transition={{ duration: 0.3 }} />
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const selected = index === active;
            return (
              <button key={stage.label} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} className="relative z-10 text-left">
                <motion.span animate={{ scale: selected ? 1.08 : 1 }} className={`grid h-12 w-12 place-items-center rounded-xl border bg-white transition ${selected ? "border-[#1f89f6] text-[#1f89f6] shadow-[0_0_0_5px_rgba(31,137,246,0.1)]" : "border-slate-200 text-slate-400"} dark:bg-[#0d1b2a]`}><Icon className="h-5 w-5" /></motion.span>
                <span className={`mt-4 block text-sm font-black ${selected ? "text-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>{stage.label}</span>
                <span className="mt-1 block text-xs font-semibold text-[#1f89f6]">{stage.meta}</span>
              </button>
            );
          })}
        </div>
      </div>
      <motion.div key={active} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-600 dark:border-sky-400/15 dark:bg-sky-400/[0.06] dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-[#1f89f6]" />{stages[active].detail}</motion.div>
    </section>
  );
}
