"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Music, TriangleAlert, Upload, Youtube } from "lucide-react";
import type { ReformOption } from "@/lib/hearings/shared";

type Mode = "transcript" | "youtube" | "audio";

const MODES: Array<{ id: Mode; label: string; icon: typeof FileText; hint: string }> = [
  { id: "transcript", label: "Subir transcripción", icon: FileText, hint: "TXT, VTT o SRT. El camino más rápido y confiable: se procesa al instante." },
  { id: "youtube", label: "YouTube", icon: Youtube, hint: "Link del video. Se baja el audio y se transcribe; puede demorar según la duración." },
  { id: "audio", label: "Subir audio/video", icon: Music, hint: "Archivo de audio o video. Se transcribe con Whisper; puede demorar según la duración." }
];

/**
 * "Cargar audiencia": registra una audiencia ya ocurrida y corre el macheo en
 * lote contra las mininormas del codigo nuevo. Tres fuentes de transcripcion.
 * La IA orienta; los cruces son sugerencias. La transcripcion no se altera.
 */
export function UploadHearing({
  reforms,
  dbAvailable,
  aiAvailable,
  audioAvailable
}: {
  reforms: ReformOption[];
  dbAvailable: boolean;
  aiAvailable: boolean;
  audioAvailable: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [reformId, setReformId] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("transcript");

  const [transcriptName, setTranscriptName] = useState("");
  const [transcriptContent, setTranscriptContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling del estado para YouTube/audio hasta que la audiencia quede
  // finalizada O falle. Antes solo se miraba COMPLETED, asi que una ingesta
  // fallida dejaba el spinner girando para siempre, sin mostrar el motivo ni
  // el boton de reintentar que ya existe en el detalle.
  useEffect(() => {
    if (!processingId) return;
    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/hearings/${processingId}`);
        if (!response.ok) return;
        const payload = await response.json();
        const hearing = payload.hearing;
        if (!hearing) return;

        if (hearing.hearingStatus === "COMPLETED") {
          router.push(`/audiencias/${processingId}`);
          return;
        }
        if (hearing.ingestError || hearing.ingestStalled) {
          setProcessingError(
            hearing.ingestError ||
              "El procesamiento se interrumpió: el servidor se detuvo mientras trabajaba. Se puede retomar desde el detalle."
          );
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Reintenta en el proximo tick.
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [processingId, router]);

  async function onTranscriptFile(file: File | null) {
    if (!file) {
      setTranscriptName("");
      setTranscriptContent("");
      return;
    }
    setTranscriptName(file.name);
    setTranscriptContent(await file.text());
  }

  const canSubmit =
    dbAvailable &&
    title.trim().length > 0 &&
    reformId.length > 0 &&
    !submitting &&
    (mode === "transcript" ? transcriptContent.trim().length >= 20 : mode === "youtube" ? youtubeUrl.trim().length > 10 : audioFile !== null);

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      let response: Response;
      if (mode === "audio") {
        const form = new FormData();
        form.set("title", title.trim());
        if (occurredAt) form.set("occurredAt", new Date(occurredAt).toISOString());
        form.set("reformId", reformId);
        if (description.trim()) form.set("description", description.trim());
        if (audioFile) form.set("file", audioFile);
        response = await fetch("/api/hearings/ingest", { method: "POST", body: form });
      } else {
        const body =
          mode === "transcript"
            ? { mode, title: title.trim(), occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null, reformId, description: description.trim() || null, fileName: transcriptName || "transcripcion.txt", content: transcriptContent }
            : { mode, title: title.trim(), occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null, reformId, description: description.trim() || null, url: youtubeUrl.trim() };
        response = await fetch("/api/hearings/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo cargar la audiencia.");

      if (payload.status === "completed") {
        router.push(`/audiencias/${payload.meetingId}`);
      } else {
        setProcessingId(payload.meetingId as string);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo cargar la audiencia.");
      setSubmitting(false);
    }
  }

  if (processingId) {
    return (
      <div className="space-y-4">
        <BackLink />
        <section className="urban-card mx-auto max-w-2xl rounded-lg p-6 text-center lg:p-10">
          {processingError ? (
            <>
              <TriangleAlert className="mx-auto h-8 w-8 text-amber-300" />
              <h1 className="mt-4 text-2xl font-black text-white">No se pudo procesar la audiencia</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-amber-100/90">{processingError}</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
                La audiencia quedó creada: desde su detalle podés ver el motivo y volver a lanzar el procesamiento.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={`/audiencias/${processingId}`}
                  className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white"
                >
                  Ir al detalle y reintentar
                </Link>
                <Link
                  href="/audiencias"
                  className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-200"
                >
                  Ir al registro
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1f89f6]" />
              <h1 className="mt-4 text-2xl font-black text-white">Procesando la audiencia…</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">
                Se está bajando y transcribiendo el audio, y cruzando el debate contra las mininormas del código nuevo. Puede demorar según la duración. Podés cerrar esta pantalla: la audiencia aparece en el registro cuando termina.
              </p>
              <Link href="/audiencias" className="urban-button mt-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-200">
                Ir al registro
              </Link>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <section className="urban-card mx-auto max-w-2xl rounded-lg p-5 lg:p-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
          <Upload className="h-4 w-4" />
          Cargar audiencia
        </div>
        <h1 className="text-3xl font-black leading-tight text-white">Registrar una audiencia grabada</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Registrá una audiencia ya ocurrida y corré el mismo cruce contra las mininormas del código nuevo, en lote. Los cruces son sugerencias para el equipo; la transcripción original no se altera.
        </p>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Título</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Audiencia pública 12/07 — alturas y usos" className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Fecha y hora</span>
              <input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Tema a tratar</span>
              <select value={reformId} onChange={(event) => setReformId(event.target.value)} className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50">
                <option value="">Elegí un tema…</option>
                {reforms.map((reform) => (
                  <option key={reform.id} value={reform.id}>{reform.code} · {reform.title}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Descripción (opcional)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="De qué trata la audiencia." className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50" />
          </label>
        </div>

        <div className="mt-6">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Fuente de la transcripción</span>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {MODES.map((option) => {
              const Icon = option.icon;
              const disabled = option.id !== "transcript" && !audioAvailable;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(option.id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    mode === option.id ? "border-[#1f89f6] bg-civic-blue/15 text-sky-100" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{MODES.find((option) => option.id === mode)?.hint}</p>

          <div className="mt-3">
            {mode === "transcript" ? (
              <div>
                <input type="file" accept=".txt,.vtt,.srt,text/plain" onChange={(event) => onTranscriptFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-civic-blue file:px-4 file:py-2 file:text-sm file:font-black file:text-white" />
                {transcriptContent ? (
                  <div className="mt-2 rounded-md border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{transcriptName} · vista previa</p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs leading-5 text-slate-400">{transcriptContent.slice(0, 500)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {mode === "youtube" ? (
              <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-sky-300/50" />
            ) : null}
            {mode === "audio" ? (
              <input type="file" accept="audio/*,video/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-civic-blue file:px-4 file:py-2 file:text-sm file:font-black file:text-white" />
            ) : null}
          </div>
        </div>

        {!dbAvailable ? <Notice>Sin conexión a la base no se puede cargar la audiencia.</Notice> : null}
        {dbAvailable && !aiAvailable ? <Notice>La IA no está configurada: la transcripción queda guardada, pero el cruce con las normas y el resumen se posponen.</Notice> : null}
        {mode !== "transcript" && !audioAvailable ? <Notice>La transcripción de audio (yt-dlp/Whisper) no está disponible en este entorno. Usá &quot;Subir transcripción&quot;, que funciona siempre.</Notice> : null}
        {error ? <p className="mt-4 text-xs font-bold text-amber-200">{error}</p> : null}

        <button type="button" onClick={submit} disabled={!canSubmit} className="urban-button mt-6 inline-flex items-center gap-2 rounded-md bg-civic-blue px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {submitting ? "Cargando…" : "Cargar y procesar"}
        </button>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
      <ArrowLeft className="h-3.5 w-3.5" />
      Audiencias públicas
    </Link>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{children}</p>;
}
