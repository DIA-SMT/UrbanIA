"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LinkableItems } from "@/lib/foro/data";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white";

export function NewDebateForm({ linkable }: { linkable: LinkableItems }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [linkKind, setLinkKind] = useState<"none" | "proposal" | "project">("none");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedHearing = linkable.hearings.find((hearing) => hearing.id === meetingId) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/debates?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          context,
          meetingId,
          closesAt: closesAt || undefined,
          proposalId: linkKind === "proposal" ? linkId || null : null,
          projectId: linkKind === "project" ? linkId || null : null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo crear el debate.");
      router.push(`/foro/${payload.debateId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el debate.");
      setBusy(false);
    }
  }

  const linkOptions = linkKind === "proposal" ? linkable.proposals.map((item) => ({ id: item.id, label: item.title })) : linkKind === "project" ? linkable.projects.map((item) => ({ id: item.id, label: item.label })) : [];

  return (
    <form onSubmit={submit} className="surface-panel space-y-4 p-5">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Pregunta del debate</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={10}
          maxLength={200}
          placeholder="¿Conviene peatonalizar la calle Muñecas entre 9 de Julio y Mendoza?"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Audiencia de origen</span>
        <select value={meetingId} onChange={(event) => setMeetingId(event.target.value)} required className={inputClass}>
          <option value="">Elegí la audiencia que da origen al debate...</option>
          {linkable.hearings.map((hearing) => (
            <option key={hearing.id} value={hearing.id}>
              {hearing.title}
              {hearing.occurredAt ? ` (${new Date(hearing.occurredAt).toLocaleDateString("es-AR")})` : ""}
            </option>
          ))}
        </select>
        {linkable.hearings.length === 0 ? (
          <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
            No hay audiencias cargadas todavía: primero registrá la audiencia en el módulo Audiencias.
          </span>
        ) : null}
      </label>

      {selectedHearing ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 dark:border-sky-400/30 dark:bg-sky-400/10">
          <p className="text-[11px] font-black uppercase tracking-wide text-sky-700 dark:text-sky-200">Qué se habló en esa audiencia</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
            {selectedHearing.summary ?? "Esta audiencia todavía no tiene resumen ni conclusiones cargadas; el debate igualmente quedará vinculado a ella."}
          </p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Contexto</span>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          required
          minLength={20}
          maxLength={4000}
          rows={5}
          placeholder="Qué se discute, por qué ahora y qué decisión alimenta este debate."
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Cierre (opcional)</span>
          <input type="date" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className={`${inputClass} urban-date-field`} />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Vincular a (opcional)</span>
          <select
            value={linkKind}
            onChange={(event) => {
              setLinkKind(event.target.value as typeof linkKind);
              setLinkId("");
            }}
            className={inputClass}
          >
            <option value="none">Debate libre, sin vínculo</option>
            <option value="proposal">Una propuesta</option>
            <option value="project">Un proyecto / norma</option>
          </select>
        </label>
      </div>

      {linkKind !== "none" ? (
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {linkKind === "proposal" ? "Propuesta" : "Proyecto"}
          </span>
          <select value={linkId} onChange={(event) => setLinkId(event.target.value)} required className={inputClass}>
            <option value="">Elegí una opción...</option>
            {linkOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/foro")}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-[0.97] dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#1f89f6] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)] transition hover:bg-[#087bec] active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? "Creando..." : "Abrir debate"}
        </button>
      </div>
    </form>
  );
}
