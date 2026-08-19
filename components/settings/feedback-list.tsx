"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFeedbackStatus } from "@prisma/client";
import { Archive, Check, Mail, RotateCcw } from "lucide-react";
import { formatDateTime } from "@/components/settings/format";
import { STATUS_LABELS, type FeedbackKindLabel } from "@/lib/feedback/shared";

type Entry = {
  id: string;
  kind: FeedbackKindLabel;
  text: string;
  name: string;
  email: string | null;
  status: AppFeedbackStatus;
  createdAt: string;
};

/** Color por tipo: un problema tiene que saltar a la vista antes que una idea. */
const KIND_STYLES: Record<FeedbackKindLabel, string> = {
  Problema: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
  Sugerencia: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
  Experiencia:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
};

export function FeedbackList({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function changeStatus(id: string, status: AppFeedbackStatus) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/citizen-contributions?action=feedback-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "No pudimos actualizar la recomendación.");
      }
      // El listado es un server component: refresh vuelve a consultar y recalcula
      // los contadores de arriba, que si no quedarían desfasados del listado.
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No pudimos actualizar la recomendación.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-2xl border px-4 py-3.5 transition ${
              entry.status === AppFeedbackStatus.ARCHIVED
                ? "border-slate-200 bg-slate-50/60 opacity-70 dark:border-white/10 dark:bg-white/[0.02]"
                : "border-slate-200 dark:border-white/10"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${KIND_STYLES[entry.kind]}`}>
                {entry.kind}
              </span>
              {entry.status === AppFeedbackStatus.NEW ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                  {STATUS_LABELS.NEW}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {STATUS_LABELS[entry.status]}
                </span>
              )}
              <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                {formatDateTime(entry.createdAt)}
              </span>
            </div>

            <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">
              {entry.text}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-2.5 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{entry.name}</span>
              {entry.email ? (
                <a
                  href={`mailto:${entry.email}`}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-sky-700 hover:underline dark:text-slate-400 dark:hover:text-sky-300"
                >
                  <Mail className="h-3 w-3" />
                  {entry.email}
                </a>
              ) : (
                // La cuenta se borro: la recomendacion queda, el contacto no.
                <span className="text-xs text-slate-400 dark:text-slate-500">cuenta dada de baja</span>
              )}

              <div className="ml-auto flex gap-1.5">
                {entry.status !== AppFeedbackStatus.REVIEWED ? (
                  <ActionButton
                    onClick={() => changeStatus(entry.id, AppFeedbackStatus.REVIEWED)}
                    disabled={busyId === entry.id}
                    icon={Check}
                    label="Marcar leída"
                  />
                ) : null}
                {entry.status !== AppFeedbackStatus.ARCHIVED ? (
                  <ActionButton
                    onClick={() => changeStatus(entry.id, AppFeedbackStatus.ARCHIVED)}
                    disabled={busyId === entry.id}
                    icon={Archive}
                    label="Archivar"
                  />
                ) : (
                  <ActionButton
                    onClick={() => changeStatus(entry.id, AppFeedbackStatus.NEW)}
                    disabled={busyId === entry.id}
                    icon={RotateCcw}
                    label="Volver a sin leer"
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  label
}: {
  onClick: () => void;
  disabled: boolean;
  icon: typeof Check;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
