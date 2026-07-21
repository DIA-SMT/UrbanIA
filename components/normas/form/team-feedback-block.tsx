"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { SupportControls, type SupportSummary } from "@/components/normas/support-controls";

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TeamFeedbackBlock({
  normId,
  canEdit,
  initialSupport,
  accountName = null
}: {
  normId: string;
  canEdit: boolean;
  initialSupport: SupportSummary;
  /** Cuenta institucional: se usa como respaldo si nadie firma con su nombre. */
  accountName?: string | null;
}) {
  const [support, setSupport] = useState<SupportSummary>(initialSupport);

  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [loadingOpinions, setLoadingOpinions] = useState(true);
  const [body, setBody] = useState("");
  // Quien firma. La cuenta es compartida, asi que sin esto todas las devoluciones
  // de una direccion aparecen con el mismo nombre.
  const [signature, setSignature] = useState("");
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

  async function publish() {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${normId}/opinions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, authorName: signature.trim() || undefined })
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
        <SupportControls normId={normId} initial={initialSupport} canVote={canEdit} onChange={setSupport} />
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Firma</span>
              <input
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                maxLength={120}
                placeholder={accountName ? `Tu nombre (si no, ${accountName})` : "Nombre y apellido"}
                className="h-9 w-64 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
              />
            </label>
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

