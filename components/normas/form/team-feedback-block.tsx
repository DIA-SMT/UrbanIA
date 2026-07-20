"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

/**
 * Devoluciones y apoyo del equipo sobre una norma ya existente. Todo interno: los
 * vecinos no opinan ni votan normas, y la API rechaza a cualquiera que no sea staff.
 *
 * Solo se monta con una norma persistida: sobre un borrador sin id no hay nada que
 * comentar ni apoyar.
 */

type Opinion = {
  id: string;
  authorName: string;
  body: string;
  userId: string | null;
  createdAt: string;
};

type SupportSummary = {
  supportCount: number;
  objectionCount: number;
  net: number;
  myValue: 1 | -1 | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TeamFeedbackBlock({
  normId,
  canEdit,
  initialSupport
}: {
  normId: string;
  canEdit: boolean;
  initialSupport: SupportSummary;
}) {
  const [support, setSupport] = useState<SupportSummary>(initialSupport);
  const [voting, setVoting] = useState(false);

  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [loadingOpinions, setLoadingOpinions] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadOpinions = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${normId}/opinions`);
      const payload = await response.json();
      if (response.ok) setOpinions(payload.opinions ?? []);
    } catch {
      // El hilo es secundario: si falla, el bloque queda vacio y el editor sigue.
    } finally {
      setLoadingOpinions(false);
    }
  }, [normId]);

  useEffect(() => {
    void loadOpinions();
  }, [loadOpinions]);

  async function vote(value: 1 | -1) {
    if (!canEdit || voting) return;
    setVoting(true);
    try {
      // Clickear el voto activo lo retira: es la unica forma de volver a neutral.
      const removing = support.myValue === value;
      const response = await fetch(`/api/projects/${normId}/support`, {
        method: removing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(removing ? {} : { body: JSON.stringify({ value }) })
      });
      const payload = await response.json();
      if (response.ok) setSupport(payload);
    } catch {
      // Sin cambio visible: el estado sigue reflejando lo ultimo confirmado.
    } finally {
      setVoting(false);
    }
  }

  async function publish() {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${normId}/opinions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail || payload?.error || "No se pudo publicar la devolución.");
        return;
      }
      setOpinions((current) => [...current, payload.opinion]);
      setBody("");
    } catch {
      setError("No se pudo publicar la devolución.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(opinionId: string) {
    try {
      const response = await fetch(`/api/projects/${normId}/opinions/${opinionId}`, { method: "DELETE" });
      if (response.ok) setOpinions((current) => current.filter((opinion) => opinion.id !== opinionId));
    } catch {
      // Idem: el hilo se recarga entero en la proxima visita.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2.5">
        <SupportButton
          tone="support"
          active={support.myValue === 1}
          count={support.supportCount}
          disabled={!canEdit || voting}
          onClick={() => vote(1)}
        />
        <SupportButton
          tone="object"
          active={support.myValue === -1}
          count={support.objectionCount}
          disabled={!canEdit || voting}
          onClick={() => vote(-1)}
        />
        <span className="text-xs text-slate-400">
          Neto{" "}
          <span className={`font-bold tabular-nums ${support.net > 0 ? "text-sky-200" : support.net < 0 ? "text-rose-200" : "text-slate-300"}`}>
            {support.net > 0 ? `+${support.net}` : support.net}
          </span>
        </span>
        {support.myValue ? <span className="text-[11px] text-slate-500">Clickeá de nuevo para retirar tu voto</span> : null}
      </div>

      <div className="space-y-2">
        {loadingOpinions ? (
          <p className="text-xs text-slate-500">Cargando devoluciones…</p>
        ) : opinions.length ? (
          opinions.map((opinion) => (
            <article key={opinion.id} className="group rounded-md border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">{opinion.authorName}</p>
                <div className="flex items-center gap-2">
                  <time className="text-[11px] text-slate-500">{formatDateTime(opinion.createdAt)}</time>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(opinion.id)}
                      className="text-slate-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                      aria-label="Borrar devolución"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-300">{opinion.body}</p>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-4 text-center text-xs text-slate-500">
            Todavía nadie dejó una devolución sobre esta norma.
          </p>
        )}
      </div>

      {canEdit ? (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Qué te parece esta norma: qué falta, qué corregirías, qué riesgo ves."
            className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
          />
          {error ? <p className="text-xs font-semibold text-amber-200">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={publish}
              disabled={!body.trim() || posting}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar devolución
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SupportButton({
  tone,
  active,
  count,
  disabled,
  onClick
}: {
  tone: "support" | "object";
  active: boolean;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const activeClass = tone === "support" ? "border-sky-300/40 bg-sky-300/10 text-sky-100" : "border-rose-300/40 bg-rose-300/10 text-rose-100";
  const Icon = tone === "support" ? ThumbsUp : ThumbsDown;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        active ? activeClass : "border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {tone === "support" ? "A favor" : "En contra"}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
