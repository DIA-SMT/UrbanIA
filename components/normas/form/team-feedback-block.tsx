"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { ActiveVoterBar, useActiveVoter } from "@/components/normas/active-voter";
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
  accountName = null,
  knownAuthors = []
}: {
  normId: string;
  canEdit: boolean;
  initialSupport: SupportSummary;
  /** Cuenta institucional, solo informativa: la firma es obligatoria igual. */
  accountName?: string | null;
  /** Gente que ya firmo algo, para elegirse en vez de reescribir el nombre. */
  knownAuthors?: string[];
}) {
  const router = useRouter();
  const { voter } = useActiveVoter();
  const [support, setSupport] = useState<SupportSummary>(initialSupport);

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

  async function publish() {
    const text = body.trim();
    // Firma y voto son la misma identidad: la que esta elegida arriba.
    const signedBy = voter.trim();
    if (!text || !signedBy || posting) return;
    setPosting(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${normId}/opinions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, authorName: signedBy })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail || payload?.error || "No se pudo publicar la devolución.");
        return;
      }
      setOpinions((current) => [...current, payload.opinion]);
      setBody("");
      // Refresca lo que sale del servidor: el conteo de devoluciones en la card y
      // el desplegable de firmas, que ahora tiene que incluir este nombre.
      router.refresh();
    } catch {
      setError("No se pudo publicar la devolución.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(opinionId: string) {
    if (!voter) return;
    try {
      // El servidor compara la identidad declarada contra la firma de la
      // devolucion: solo su autor puede borrarla.
      const response = await fetch(`/api/projects/${normId}/opinions/${opinionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName: voter })
      });
      if (response.ok) {
        setOpinions((current) => current.filter((opinion) => opinion.id !== opinionId));
        router.refresh();
      }
    } catch {
      // Idem: el hilo se recarga entero en la proxima visita.
    }
  }

  const myValue = voter ? support.voters.find((entry) => entry.voterName === voter)?.value ?? null : null;

  return (
    <div className="space-y-4">
      {canEdit ? <ActiveVoterBar knownAuthors={knownAuthors} /> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2.5">
        <SupportControls normId={normId} initial={initialSupport} canVote={canEdit} onChange={setSupport} />
        <span className="text-xs text-slate-400">
          Neto{" "}
          <span className={`font-bold tabular-nums ${support.net > 0 ? "text-sky-200" : support.net < 0 ? "text-rose-200" : "text-slate-300"}`}>
            {support.net > 0 ? `+${support.net}` : support.net}
          </span>
        </span>
        {myValue ? <span className="text-[11px] text-slate-500">Clickeá de nuevo para retirar tu voto</span> : null}
        {support.voters.length ? (
          <span className="text-[11px] text-slate-500">
            Votaron: {support.voters.map((entry) => entry.voterName).join(", ")}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {loadingOpinions ? (
          <p className="text-xs text-slate-500">Cargando devoluciones…</p>
        ) : opinions.length ? (
          opinions.map((opinion) => {
            // Es la devolucion de quien esta trabajando: se destaca para que se
            // reconozca la propia dentro del hilo.
            const mine = Boolean(voter) && opinion.authorName === voter;
            return (
              <article key={opinion.id} className="group flex gap-3">
                <Avatar name={opinion.authorName} highlighted={mine} />
                <div
                  className={`relative min-w-0 flex-1 rounded-xl rounded-tl-sm border px-3.5 py-2.5 transition ${
                    mine
                      ? "border-civic-blue/30 bg-civic-blue/[0.07]"
                      : "border-white/8 bg-white/[0.03] group-hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-200">
                      {opinion.authorName}
                      {mine ? <span className="ml-1.5 font-medium text-sky-300/70">· vos</span> : null}
                    </p>
                    <div className="flex items-center gap-2">
                      <time className="text-[11px] tabular-nums text-slate-500">{formatDateTime(opinion.createdAt)}</time>
                      {/* Borrar solo lo propio: el tachito aparece unicamente en
                          la devolucion firmada por la identidad activa. */}
                      {canEdit && mine ? (
                        <button
                          type="button"
                          onClick={() => remove(opinion.id)}
                          className="text-slate-600 opacity-0 transition hover:text-civic-rose focus:opacity-100 group-hover:opacity-100"
                          aria-label="Borrar tu devolución"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{opinion.body}</p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center">
            <MessageSquarePlus className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-2 text-xs text-slate-500">Todavía nadie dejó una devolución sobre esta norma.</p>
          </div>
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
            <p className="text-[11px] text-slate-500">
              {voter ? (
                <>
                  Firmás como <span className="font-semibold text-slate-300">{voter}</span>
                  {accountName ? ` · ${accountName}` : ""}
                </>
              ) : (
                <span className="text-amber-200/80">Elegí tu nombre arriba para publicar.</span>
              )}
            </p>
            <button
              type="button"
              onClick={publish}
              disabled={!body.trim() || !voter.trim() || posting}
              title={!voter.trim() ? "Elegí tu nombre arriba para publicar" : undefined}
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

/** Paleta del avatar. Azules y celestes institucionales, sin verde: el verde
 *  esta reservado al apoyo y perderia su significado si tambien decorara. */
const AVATAR_TONES = [
  "bg-civic-blue/15 text-sky-200 ring-civic-blue/25",
  "bg-sky-400/15 text-sky-200 ring-sky-400/25",
  "bg-indigo-400/15 text-indigo-200 ring-indigo-400/25",
  "bg-slate-400/15 text-slate-200 ring-slate-400/25"
];

/**
 * Iniciales de quien firma. El tono se deriva del nombre, no del orden, para que
 * cada persona conserve el mismo color en todas las normas y el hilo se lea de un
 * vistazo.
 */
function Avatar({ name, highlighted }: { name: string; highlighted: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % AVATAR_TONES.length;

  return (
    <span
      aria-hidden
      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ${
        highlighted ? AVATAR_TONES[0] : AVATAR_TONES[hash]
      }`}
    >
      {initials || "?"}
    </span>
  );
}

