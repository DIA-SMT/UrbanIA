"use client";

import { useState } from "react";
import { Loader2, Radio, ShieldAlert } from "lucide-react";
import type { ReformOption } from "@/lib/hearings/shared";

const MODALITIES = ["Presencial", "Virtual", "Mixta"] as const;
const OTHER = "__other__";

/**
 * Paso 1 del flujo de nueva audiencia: la ficha. Al guardar se crea la
 * audiencia (hearingSource LIVE, hearingStatus SCHEDULED) y se pasa al vivo.
 */
export function HearingForm({
  reforms,
  dbAvailable,
  onCreated
}: {
  reforms: ReformOption[];
  dbAvailable: boolean;
  onCreated: (meeting: { id: string; title: string; reformId: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [modality, setModality] = useState<string>(MODALITIES[0]);
  const [reformId, setReformId] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isOther = reformId === OTHER;
  const hasReform = reformId.length > 0 && !isOther;
  const canSubmit = dbAvailable && title.trim().length > 0 && (hasReform || (isOther && topic.trim().length > 0)) && !saving;

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/hearings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
          modality,
          reformId: hasReform ? reformId : null,
          topic: isOther ? topic.trim() : null,
          description: description.trim() || null,
          hearingSource: "LIVE"
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo crear la audiencia.");
      onCreated({ id: payload.hearing.id as string, title: title.trim(), reformId: hasReform ? reformId : "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la audiencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="urban-card mx-auto max-w-2xl rounded-lg p-5 lg:p-7">
      <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
        <Radio className="h-4 w-4" />
        Nueva audiencia · Paso 1 de 2
      </div>
      <h1 className="text-3xl font-black leading-tight text-white">Ficha de la audiencia</h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        Registrá los datos de la audiencia. Después iniciás el dictado en vivo y Migue cruza el debate contra las mininormas del código nuevo elegido. Los cruces son sugerencias para el equipo; no deciden nada.
      </p>

      <div className="mt-6 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Audiencia pública — Código de Planeamiento 2026, alturas y usos"
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Fecha y hora</span>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Modalidad</span>
            <select
              value={modality}
              onChange={(event) => setModality(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
            >
              {MODALITIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Tema a tratar</span>
          <select
            value={reformId}
            onChange={(event) => setReformId(event.target.value)}
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
          >
            <option value="">Elegí un tema…</option>
            {reforms.map((reform) => (
              <option key={reform.id} value={reform.id}>
                {reform.code} · {reform.title}
              </option>
            ))}
            <option value={OTHER}>Otro — escribir el tema</option>
          </select>
        </label>

        {isOther ? (
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Tema (texto libre)</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Ej. Uso del espacio público en la plaza central"
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
            />
            <span className="text-xs leading-5 text-slate-500">
              Al escribir un tema libre, la audiencia no queda vinculada a un código nuevo: el cruce automático con las normas queda desactivado.
            </span>
          </label>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Descripción (opcional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="De qué trata la audiencia, qué se va a debatir, documentos de referencia."
            className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
          />
        </label>
      </div>

      {!dbAvailable ? (
        <p className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          Sin conexión a la base de datos no se puede registrar la audiencia.
        </p>
      ) : null}
      {reforms.length === 0 && dbAvailable ? (
        <p className="mt-4 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-bold leading-5 text-sky-100">
          No hay códigos nuevos en la Fábrica de Normas. Podés abrir la audiencia con un tema libre (elegí “Otro”); el cruce automático con las normas queda para cuando haya un código.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-xs font-bold text-amber-200">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="urban-button mt-6 inline-flex items-center gap-2 rounded-md bg-civic-blue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saving ? "Creando la ficha..." : "Crear y continuar"}
      </button>

      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        El dictado usa el reconocimiento de voz del navegador: el audio se envía a su proveedor (en Chrome, servidores de Google) para transcribir. La audiencia es pública; aun así, avisalo al abrir la sesión. Requiere permiso de micrófono.
      </p>
    </section>
  );
}
