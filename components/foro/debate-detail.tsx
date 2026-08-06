"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Archive, CalendarDays, EyeOff, LockOpen, Lock, RotateCcw, Sparkles, ThumbsUp } from "lucide-react";
import type { DebateStance } from "@prisma/client";
import { SettingsModal } from "@/components/settings/modal";
import { formatDate, formatDateTime } from "@/components/settings/format";
import type { DebateArgumentItem, DebateDetail } from "@/lib/foro/data";
import {
  ARGUMENT_MAX_LENGTH,
  ARGUMENT_MIN_LENGTH,
  debateStatusBadgeClasses,
  debateStatusLabels,
  stanceBadgeClasses,
  stanceLabels
} from "@/lib/foro/shared";

export function DebateDetailView({
  debate,
  canParticipate,
  canModerate,
  canManage
}: {
  debate: DebateDetail;
  canParticipate: boolean;
  canModerate: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hideTarget, setHideTarget] = useState<DebateArgumentItem | null>(null);
  const isOpen = debate.status === "OPEN";

  async function post(action: string, body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(`/api/debates?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "No se pudo completar la operación.");
      return false;
    }
    router.refresh();
    return true;
  }

  const forArguments = debate.arguments.filter((argument) => argument.stance === "FOR");
  const againstArguments = debate.arguments.filter((argument) => argument.stance === "AGAINST");
  const neutralArguments = debate.arguments.filter((argument) => argument.stance === "NEUTRAL");

  return (
    <div>
      <Link href="/foro" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al foro
      </Link>

      <section className="surface-panel mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{debate.title}</h1>
            <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
              {debate.linkedLabel ? `${debate.linkedLabel} · ` : ""}
              {debate.closesAt ? `cierra ${formatDate(debate.closesAt)} · ` : ""}
              {debate.createdByName ? `abierto por ${debate.createdByName} el ${formatDate(debate.createdAt)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${debateStatusBadgeClasses[debate.status]}`}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {debateStatusLabels[debate.status]}
            </span>
            {canManage ? <ManageMenu debateId={debate.id} status={debate.status} onAction={post} /> : null}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{debate.context}</p>

        {debate.hearing ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 dark:border-sky-400/30 dark:bg-sky-400/10">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-sky-700 dark:text-sky-200">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Audiencia de origen
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              <Link href={`/audiencias/${debate.hearing.id}`} className="underline decoration-sky-300 underline-offset-2 hover:text-sky-700 dark:hover:text-sky-200">
                {debate.hearing.title}
              </Link>
              {debate.hearing.occurredAt ? <span className="font-semibold text-slate-500 dark:text-slate-400"> · {formatDate(debate.hearing.occurredAt)}</span> : null}
            </p>
            {debate.hearing.summary ? (
              <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{debate.hearing.summary}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">La audiencia todavía no tiene resumen ni conclusiones cargadas.</p>
            )}
          </div>
        ) : null}
      </section>

      <AnalysisSection debate={debate} canManage={canManage} onAnalyze={() => post("analyze", { debateId: debate.id })} />

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <StanceColumn
          stance="FOR"
          items={forArguments}
          canParticipate={canParticipate && isOpen}
          canModerate={canModerate}
          onSupport={(argumentId) => post("support", { argumentId })}
          onHide={setHideTarget}
          onRestore={(argumentId) => post("moderate", { argumentId, hide: false })}
        />
        <StanceColumn
          stance="AGAINST"
          items={againstArguments}
          canParticipate={canParticipate && isOpen}
          canModerate={canModerate}
          onSupport={(argumentId) => post("support", { argumentId })}
          onHide={setHideTarget}
          onRestore={(argumentId) => post("moderate", { argumentId, hide: false })}
        />
      </div>

      {neutralArguments.length > 0 ? (
        <div className="mt-4">
          <StanceColumn
            stance="NEUTRAL"
            items={neutralArguments}
            canParticipate={canParticipate && isOpen}
            canModerate={canModerate}
            onSupport={(argumentId) => post("support", { argumentId })}
            onHide={setHideTarget}
            onRestore={(argumentId) => post("moderate", { argumentId, hide: false })}
          />
        </div>
      ) : null}

      {canParticipate && isOpen ? (
        <Composer debateId={debate.id} onSubmit={post} />
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
          {isOpen
            ? "Tu rol es de solo lectura en el foro."
            : "El debate está cerrado: se conservan los argumentos como registro de la deliberación."}
        </p>
      )}

      {hideTarget ? (
        <HideArgumentModal
          argument={hideTarget}
          onClose={() => setHideTarget(null)}
          onConfirm={async (reason) => {
            const ok = await post("moderate", { argumentId: hideTarget.id, hide: true, reason });
            if (ok) setHideTarget(null);
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}

function AnalysisSection({
  debate,
  canManage,
  onAnalyze
}: {
  debate: DebateDetail;
  canManage: boolean;
  onAnalyze: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const isClosed = debate.status === "CLOSED";
  const analysis = debate.analysis;

  // Sin informe y sin posibilidad de generarlo: no ocupar lugar.
  if (!analysis && !(canManage && isClosed)) return null;

  async function generate() {
    setBusy(true);
    await onAnalyze();
    setBusy(false);
  }

  return (
    <section className="surface-panel mt-4 p-5" aria-label="Análisis de Migue">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          Análisis de Migue
          {analysis ? (
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {formatDateTime(analysis.generatedAt)} · sobre {analysis.argumentCount} argumento{analysis.argumentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
        {canManage && isClosed ? (
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 active:scale-[0.97] disabled:opacity-60 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
          >
            {busy ? "Migue está leyendo el debate..." : analysis ? "Regenerar análisis" : "Generar análisis"}
          </button>
        ) : null}
      </div>

      {analysis ? (
        <div className="mt-4 space-y-4">
          {analysis.newArgumentsSince > 0 ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
              Entraron {analysis.newArgumentsSince} argumento{analysis.newArgumentsSince === 1 ? "" : "s"} después de este análisis: puede estar desactualizado.
            </p>
          ) : null}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Lectura general</p>
            <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">{analysis.report.lecturaGeneral}</p>
          </div>
          <ReportList title="Puntos de acuerdo" items={analysis.report.coherencias} emptyText="No se detectaron puntos compartidos entre las posturas." />
          <ReportList title="Incongruencias" items={analysis.report.incongruencias} emptyText="No se detectaron contradicciones entre los argumentos." />
          <ReportList title="Información faltante" items={analysis.report.vacios} emptyText="No se señalaron vacíos de información." />
          {analysis.report.caminoConsenso ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 dark:border-emerald-400/40 dark:bg-emerald-400/10">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Posible camino de consenso</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{analysis.report.caminoConsenso}</p>
            </div>
          ) : null}
          <p className="text-[11px] leading-4 text-slate-400 dark:text-slate-500">
            Análisis asistido generado por Migue sobre los argumentos visibles al cierre. Es un insumo de lectura, no una conclusión oficial: la decisión sigue siendo del equipo.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          El debate está cerrado: podés pedirle a Migue una devolución sobre toda la deliberación — lectura general, acuerdos, incongruencias e información faltante.
        </p>
      )}
    </section>
  );
}

function ReportList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{emptyText}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[#1f89f6]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StanceColumn({
  stance,
  items,
  canParticipate,
  canModerate,
  onSupport,
  onHide,
  onRestore
}: {
  stance: DebateStance;
  items: DebateArgumentItem[];
  canParticipate: boolean;
  canModerate: boolean;
  onSupport: (argumentId: string) => Promise<boolean>;
  onHide: (argument: DebateArgumentItem) => void;
  onRestore: (argumentId: string) => Promise<boolean>;
}) {
  const total = items.filter((item) => !item.hidden).length;
  return (
    <section className="surface-panel p-4" aria-label={`Argumentos ${stanceLabels[stance].toLowerCase()}`}>
      <p className="flex items-center justify-between">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${stanceBadgeClasses[stance]}`}>
          {stanceLabels[stance]}
        </span>
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{total} argumento{total === 1 ? "" : "s"}</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-white/15 dark:text-slate-500">
          Todavía nadie argumentó {stanceLabels[stance].toLowerCase() === "aporte neutral" ? "con un aporte neutral" : stanceLabels[stance].toLowerCase()}.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((argument) => (
            <li
              key={argument.id}
              className={`rounded-xl border p-3.5 ${
                argument.hidden
                  ? "border-dashed border-slate-300 opacity-60 dark:border-white/15"
                  : "border-slate-200/80 dark:border-white/10"
              }`}
            >
              {argument.hidden ? (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  Oculto por moderación{argument.hiddenReason ? `: ${argument.hiddenReason}` : ""}
                </p>
              ) : null}
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{argument.content}</p>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {argument.authorName ?? "Cuenta eliminada"}
                  {argument.authorOccupation ? ` · ${argument.authorOccupation}` : ""}
                  {" · "}
                  {formatDateTime(argument.createdAt)}
                </p>
                <div className="flex items-center gap-1.5">
                  {canModerate && !argument.hidden ? (
                    <button
                      onClick={() => onHide(argument)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-700 dark:border-white/10 dark:text-slate-400"
                    >
                      Ocultar
                    </button>
                  ) : null}
                  {canModerate && argument.hidden ? (
                    <button
                      onClick={() => onRestore(argument.id)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:text-slate-400"
                    >
                      Restaurar
                    </button>
                  ) : null}
                  {!argument.hidden ? (
                    <button
                      onClick={() => onSupport(argument.id)}
                      disabled={!canParticipate || argument.isOwn}
                      title={argument.isOwn ? "No podés adherir a tu propio argumento" : argument.viewerSupported ? "Quitar adhesión" : "Adherir"}
                      aria-pressed={argument.viewerSupported}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 ${
                        argument.viewerSupported
                          ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
                          : "border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                      {argument.supportCount}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Composer({ debateId, onSubmit }: { debateId: string; onSubmit: (action: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const [stance, setStance] = useState<DebateStance>("FOR");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ok = await onSubmit("argument", { debateId, stance, content });
    if (ok) setContent("");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="surface-panel mt-4 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Sumá tu argumento</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select
          value={stance}
          onChange={(event) => setStance(event.target.value as DebateStance)}
          aria-label="Postura"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-44 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
        >
          {(Object.keys(stanceLabels) as DebateStance[]).map((option) => (
            <option key={option} value={option}>{stanceLabels[option]}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          minLength={ARGUMENT_MIN_LENGTH}
          maxLength={ARGUMENT_MAX_LENGTH}
          rows={2}
          placeholder={`Tu argumento, con fundamento (mínimo ${ARGUMENT_MIN_LENGTH} caracteres).`}
          className="min-h-[46px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#1f89f6] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)] transition hover:bg-[#087bec] active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? "Publicando..." : "Publicar"}
        </button>
      </div>
    </form>
  );
}

function ManageMenu({
  debateId,
  status,
  onAction
}: {
  debateId: string;
  status: DebateDetail["status"];
  onAction: (action: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "OPEN" | "CLOSED" | "ARCHIVED") {
    setBusy(true);
    await onAction("status", { debateId, status: next });
    setBusy(false);
  }

  const buttonClass =
    "flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-200";

  return (
    <div className="flex items-center gap-1.5">
      {status === "OPEN" ? (
        <button onClick={() => setStatus("CLOSED")} disabled={busy} className={buttonClass}>
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Cerrar debate
        </button>
      ) : (
        <button onClick={() => setStatus("OPEN")} disabled={busy} className={buttonClass}>
          <LockOpen className="h-3.5 w-3.5" aria-hidden />
          Reabrir
        </button>
      )}
      {status !== "ARCHIVED" ? (
        <button onClick={() => setStatus("ARCHIVED")} disabled={busy} className={buttonClass}>
          <Archive className="h-3.5 w-3.5" aria-hidden />
          Archivar
        </button>
      ) : (
        <button onClick={() => setStatus("CLOSED")} disabled={busy} className={buttonClass}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Desarchivar
        </button>
      )}
    </div>
  );
}

function HideArgumentModal({
  argument,
  onClose,
  onConfirm
}: {
  argument: DebateArgumentItem;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ok = await onConfirm(reason);
    if (!ok) setBusy(false);
  }

  return (
    <SettingsModal
      title="Ocultar argumento"
      description="El argumento deja de verse en el debate, pero no se borra: queda registrado con tu usuario y el motivo."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <blockquote className="rounded-xl border border-slate-200 p-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300">
          {argument.content.length > 240 ? `${argument.content.slice(0, 240)}...` : argument.content}
        </blockquote>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={300}
            rows={2}
            placeholder="Ej.: lenguaje agresivo hacia otro participante."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-[0.97] dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? "Ocultando..." : "Ocultar"}
          </button>
        </div>
      </form>
    </SettingsModal>
  );
}
