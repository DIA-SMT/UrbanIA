"use client";

import { useState } from "react";
import { Check, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * Pulgares de feedback debajo de cada respuesta de Migue. El voto positivo se
 * guarda directo; el negativo despliega motivos rápidos y un comentario opcional.
 * El voto ya emitido se persiste con el mensaje para no volver a preguntar.
 */

export type FeedbackRating = "up" | "down";

const REASONS = [
  { value: "no_responde", label: "No responde lo que pregunté" },
  { value: "fuente_no_coincide", label: "La fuente no coincide" },
  { value: "desactualizada", label: "Información desactualizada" }
] as const;

type AnswerFeedbackProps = {
  question: string;
  answer: string;
  sourceReference?: string | null;
  model?: string | null;
  initialRating?: FeedbackRating | null;
  onRated: (rating: FeedbackRating) => void;
};

export function AnswerFeedback({ question, answer, sourceReference, model, initialRating, onRated }: AnswerFeedbackProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(initialRating ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"] | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(nextRating: FeedbackRating, extra: { reason?: string | null; comment?: string } = {}) {
    setSending(true);
    try {
      await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: nextRating,
          reason: extra.reason ?? null,
          comment: extra.comment || null,
          question,
          answer,
          sourceReference: sourceReference ?? null,
          model: model ?? null
        })
      });
    } catch {
      // El feedback nunca debe romper el chat: si falla, se registra igual en la UI.
    } finally {
      setSending(false);
      setFormOpen(false);
      setRating(nextRating);
      onRated(nextRating);
    }
  }

  if (rating) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" />
        Gracias, tu opinión ayuda a mejorar a Migue
      </p>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">¿Te sirvió?</span>
        <button
          type="button"
          onClick={() => submit("up")}
          disabled={sending}
          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:border-white/10 dark:text-slate-400 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300"
          aria-label="La respuesta fue útil"
        >
          {sending && !formOpen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setFormOpen((current) => !current)}
          disabled={sending}
          className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${
            formOpen
              ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300"
              : "border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-rose-400/40 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
          }`}
          aria-label="La respuesta no fue útil"
          aria-expanded={formOpen}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {formOpen ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">¿Qué falló?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REASONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReason((current) => (current === option.value ? null : option.value))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  reason === option.value
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200"
                    : "border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Contanos más (opcional)"
            maxLength={1000}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => submit("down", { reason, comment: comment.trim() })}
            disabled={sending}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1f89f6] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#087bec] disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Enviar
          </button>
        </div>
      ) : null}
    </div>
  );
}
