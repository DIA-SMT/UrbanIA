"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Building2, CalendarDays, MapPin, MessageSquareText, Route } from "lucide-react";
import { urbanProjects } from "@/lib/demo/urban-projects";
import type { DashboardMetric } from "@/lib/dashboard/data";

const filters = ["Todos", "Proyectos", "Propuestas", "Audiencias", "Alertas"] as const;
type Filter = (typeof filters)[number];

export function CityMap({ dashboardMetrics }: { dashboardMetrics?: DashboardMetric[] }) {
  const [filter, setFilter] = useState<Filter>("Todos");
  const [selectedId, setSelectedId] = useState(urbanProjects[0]?.id);
  const selected = urbanProjects.find((project) => project.id === selectedId) ?? urbanProjects[0];
  const projects = useMemo(() => filter === "Todos" || filter === "Proyectos" ? urbanProjects : filter === "Alertas" ? urbanProjects.filter((item) => item.risks.length > 0) : urbanProjects.filter((item) => item.linkedHearingId), [filter]);

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 p-5 dark:border-white/10 md:p-6">
        <div><p className="eyebrow">Estado de la ciudad</p><h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Lectura territorial integrada</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Proyectos, participación y alertas vinculados al territorio.</p></div>
        <div className="urban-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/[0.05]">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${filter === item ? "bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500"}`}>{item}</button>)}</div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <div className="relative min-h-[430px] overflow-hidden bg-[#e8eef3] dark:bg-[#071724]">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(31,137,246,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(31,137,246,.07)_1px,transparent_1px)] [background-size:38px_38px]" />
          <div className="absolute -left-16 top-12 h-24 w-[120%] -rotate-6 border-y-[18px] border-white/80 bg-slate-300/60 dark:border-[#102a3b] dark:bg-[#163349]" />
          <div className="absolute left-1/3 top-[-10%] h-[120%] w-20 rotate-12 border-x-[14px] border-white/75 bg-slate-300/50 dark:border-[#102a3b] dark:bg-[#163349]" />
          <div className="absolute bottom-8 left-8 rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/85 dark:text-slate-400">SMT · 26.8241° S / 65.2226° O</div>
          {projects.map((project, index) => {
            const left = 16 + ((Math.abs(project.position[1] * 1000) + index * 19) % 66);
            const top = 18 + ((Math.abs(project.position[0] * 1000) + index * 17) % 62);
            const active = selected?.id === project.id;
            return <button key={project.id} onClick={() => setSelectedId(project.id)} style={{ left: `${left}%`, top: `${top}%` }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" aria-label={`Ver ${project.title}`}><span className={`relative grid h-10 w-10 place-items-center rounded-xl border-2 border-white bg-[#1f89f6] text-white shadow-lg transition hover:-translate-y-1 ${active ? "ring-4 ring-sky-400/20" : ""}`}><MapPin className="h-4 w-4" /><span className="absolute inset-0 -z-10 animate-ping rounded-xl bg-sky-400/20 [animation-duration:3s]" /></span></button>;
          })}
          <div className="absolute left-4 top-4 rounded-xl border border-white/70 bg-white/85 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0d1b2a]/90">{dashboardMetrics?.slice(0, 3).map((metric) => <div key={metric.label} className="flex items-center justify-between gap-6 border-b border-slate-100 px-2 py-1.5 text-xs last:border-0 dark:border-white/5"><span className="text-slate-500">{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
        </div>
        <aside className="border-t border-slate-200/80 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.02] lg:border-l lg:border-t-0 md:p-6">
          {selected ? <><div className="flex items-center justify-between"><span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">{selected.neighborhood}</span><span className="text-xs font-bold text-slate-400">{selected.status}</span></div><h3 className="mt-5 text-xl font-black leading-tight text-slate-950 dark:text-white">{selected.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{selected.description}</p><div className="mt-6 grid grid-cols-2 gap-2"><ContextMetric icon={Building2} value="1" label="proyecto activo" /><ContextMetric icon={CalendarDays} value={selected.linkedHearingId ? "1" : "0"} label="audiencia vinculada" /><ContextMetric icon={MessageSquareText} value={String(selected.comments)} label="intervenciones" /><ContextMetric icon={AlertTriangle} value={String(selected.risks.length)} label="riesgos a revisar" /></div><Link href={`/proyectos/${selected.id}`} className="primary-button mt-6 flex w-full">Ver contexto territorial<ArrowUpRight className="h-4 w-4" /></Link></> : <div className="grid h-full place-items-center text-sm text-slate-400"><Route className="mb-3 h-8 w-8" />Seleccioná un punto territorial</div>}
        </aside>
      </div>
    </section>
  );
}

function ContextMetric({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"><Icon className="h-4 w-4 text-[#1f89f6]" /><strong className="mt-3 block text-lg text-slate-950 dark:text-white">{value}</strong><span className="text-[11px] leading-4 text-slate-500">{label}</span></div>;
}
