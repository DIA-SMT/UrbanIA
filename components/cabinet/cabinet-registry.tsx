"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { cabinetMeetings, cabinetSummary, type CabinetMeeting, type CabinetTopicStatus } from "@/lib/demo/cabinet-meetings";

const statusStyles: Record<CabinetTopicStatus, string> = {
  Pendiente: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  "En analisis": "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Priorizado: "border-sky-300/20 bg-sky-300/10 text-sky-200",
  Elevado: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
};

const minutesStyles: Record<CabinetMeeting["minutesStatus"], string> = {
  Borrador: "bg-amber-300/10 text-amber-200",
  Validada: "bg-sky-300/10 text-sky-200",
  Pendiente: "bg-slate-300/10 text-slate-300"
};

export function CabinetRegistry() {
  const [selectedMeetingId, setSelectedMeetingId] = useState(cabinetMeetings[0]?.id ?? "");
  const selectedMeeting = useMemo(
    () => cabinetMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? cabinetMeetings[0],
    [selectedMeetingId]
  );

  return (
    <>
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <BookOpen className="h-4 w-4" />
              Gestion interna
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">Registro de reuniones de gabinete</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Actas, agenda, responsables, decisiones y pendientes vinculados a propuestas urbanas, audiencias y escenarios de decision.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
                <Plus className="h-4 w-4" />
                Nueva reunion
              </button>
              <button className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
                <FileText className="h-4 w-4" />
                Exportar acta
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryCard label="Reuniones" value={cabinetSummary.meetings.toString()} icon={CalendarDays} />
            <SummaryCard label="Decisiones" value={cabinetSummary.decisions.toString()} icon={CheckCircle2} />
            <SummaryCard label="Pendientes" value={cabinetSummary.pending.toString()} icon={Clock3} />
            <SummaryCard label="Actas validadas" value={cabinetSummary.validatedMinutes.toString()} icon={ShieldCheck} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="urban-card rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white">Reuniones recientes</h2>
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs font-bold text-slate-300">Demo</span>
          </div>
          <div className="space-y-3">
            {cabinetMeetings.map((meeting) => {
              const isSelected = meeting.id === selectedMeeting.id;

              return (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => setSelectedMeetingId(meeting.id)}
                  aria-pressed={isSelected}
                  className={`urban-lift w-full rounded-lg border p-4 text-left transition ${
                    isSelected ? "border-sky-300/35 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:border-sky-300/25"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-950/50 px-2 py-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {meeting.date} - {meeting.time}
                    </span>
                    <span className={`rounded-md border px-2 py-1 font-black ${statusStyles[meeting.status]}`}>{meeting.status}</span>
                  </div>
                  <h3 className="text-base font-black leading-6 text-white">{meeting.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{meeting.summary}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                    <span>{meeting.area}</span>
                    <span className={`rounded-md px-2 py-1 ${minutesStyles[meeting.minutesStatus]}`}>{meeting.minutesStatus}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <MeetingDetail meeting={selectedMeeting} />
      </section>
    </>
  );
}

function MeetingDetail({ meeting }: { meeting: CabinetMeeting }) {
  return (
    <div className="grid gap-4">
      <section className="urban-card rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Acta seleccionada</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl">{meeting.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{meeting.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-md border px-3 py-2 text-xs font-black ${statusStyles[meeting.status]}`}>{meeting.status}</span>
            <span className={`rounded-md px-3 py-2 text-xs font-black ${minutesStyles[meeting.minutesStatus]}`}>Acta: {meeting.minutesStatus}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Expediente" value={meeting.expediente} icon={FileText} />
          <InfoTile label="Ubicacion" value={meeting.location} icon={MapPin} />
          <InfoTile label="Responsable" value={meeting.owner} icon={Users} />
          <InfoTile label="Area lider" value={meeting.area} icon={GitBranch} />
        </div>
      </section>


      <section className="urban-card urban-lift rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <Sparkles className="h-5 w-5 text-sky-300" />
            Sintesis de conversacion
          </h2>
          <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-black text-sky-200">Resumen IA mock</span>
        </div>
        <p className="text-sm leading-7 text-slate-300">{meeting.conversationSummary}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <p className="mb-3 text-sm font-black text-white">Posturas por area</p>
            <Checklist items={meeting.keyPositions} tone="emerald" />
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="mb-3 text-sm font-black text-amber-100">Riesgos conversados</p>
            <Checklist items={meeting.risksDiscussed} tone="amber" />
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Agenda tratada" icon={MessageSquare}>
          <OrderedList items={meeting.agenda} />
        </Panel>
        <Panel title="Participantes" icon={Users}>
          <div className="flex flex-wrap gap-2">
            {meeting.participants.map((participant) => (
              <span key={participant} className="rounded-md border border-white/8 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200">{participant}</span>
            ))}
          </div>
        </Panel>
        <Panel title="Decisiones tomadas" icon={CheckCircle2}>
          <Checklist items={meeting.decisions} tone="emerald" />
        </Panel>
        <Panel title="Pendientes" icon={Clock3}>
          <Checklist items={meeting.pending} tone="amber" />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Documentacion asociada" icon={Paperclip}>
          <div className="grid gap-3 md:grid-cols-2">
            {meeting.documents.map((document) => (
              <div key={document} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm font-semibold text-slate-300">
                <FileText className="h-4 w-4 text-civic-sky" />
                {document}
              </div>
            ))}
          </div>
        </Panel>

        <aside className="urban-card rounded-lg p-5">
          <h2 className="mb-4 text-lg font-black text-white">Trazabilidad</h2>
          <div className="grid gap-3">
            {meeting.linkedProjectId ? (
              <Link href={`/proyectos/${meeting.linkedProjectId}`} className="urban-button inline-flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
                Ver proyecto vinculado
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {meeting.linkedScenarioId ? (
              <Link href={`/escenarios/${meeting.linkedScenarioId}`} className="urban-button inline-flex items-center justify-between gap-3 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
                Abrir escenario
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-sm font-black text-amber-100">Proximo paso</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Validar el acta y convertir los pendientes en tareas asignables cuando conectemos usuarios y base de datos.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) {
  return (
    <div className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-civic-sky" />
        <p className="text-2xl font-black text-white">{value}</p>
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileText }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-4">
      <Icon className="mb-3 h-4 w-4 text-civic-sky" />
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-slate-200">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof MessageSquare; children: React.ReactNode }) {
  return (
    <div className="urban-card urban-lift rounded-lg p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
        <Icon className="h-5 w-5 text-civic-sky" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function OrderedList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={item} className="flex items-start gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-300/10 text-xs font-black text-sky-200">{index + 1}</span>
          {item}
        </div>
      ))}
    </div>
  );
}

function Checklist({ items, tone }: { items: string[]; tone: "emerald" | "amber" }) {
  const iconColor = tone === "emerald" ? "text-sky-300" : "text-amber-300";

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
          <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${iconColor}`} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}
