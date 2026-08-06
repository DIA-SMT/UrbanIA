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
  const [closesAt, setClosesAt] = useState("");
  const [linkKind, setLinkKind] = useState<"none" | "proposal" | "project">("none");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
