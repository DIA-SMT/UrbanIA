"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Loader2, TriangleAlert, Wand2 } from "lucide-react";

import type { HearingMediaView } from "@/lib/hearings/shared";

/**
 * Analisis de una audiencia grabada: transcribe los tramos y despues corre el
 * cierre (cruces con las normas, resumen, participantes e indexado a Migue).
 *
 * El recorrido lo maneja el NAVEGADOR, un tramo por llamada, porque transcribir
 * dos horas de una sola vez no entra en el limite de tiempo de una funcion de
 * Vercel. De paso se gana progreso real en pantalla y que un tramo que falla no
 * tire abajo todo el trabajo anterior.
 */

/** Tramos que se transcriben a la vez. Medido: un tramo de 5 min tarda ~1 min. */
const PARALLEL = 3;

export function AudioAnalysisPanel({ hearingId, media }: { hearingId: string; media: HearingMediaView[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "transcribing" | "closing">("idle");
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");

  const parts = useMemo(() => media.filter((item) => item.kind === "AUDIO"), [media]);
  const pending = useMemo(() => parts.filter((part) => part.status !== "READY"), [parts]);
  const failed = useMemo(() => parts.filter((part) => part.status === "ERROR"), [parts]);

  /** Corre `worker` sobre la lista con un tope de tareas simultaneas. */
  const runPool = useCallback(async <T,>(items: T[], worker: (item: T) => Promise<void>) => {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]);
      }
    });
    await Promise.all(runners);
  }, []);

  const analyze = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError("");
    setDone(0);
    setPhase("transcribing");

    const failures: string[] = [];
    try {
      await runPool(pending, async (part) => {
        const response = await fetch(`/api/hearings/${hearingId}?action=transcribe-part`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: part.id })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          failures.push(`${part.fileName}: ${payload?.detail || payload?.error || response.status}`);
          return;
        }
        setDone((current) => current + 1);
      });

      if (failures.length) {
        // Los tramos que si salieron quedan guardados: al reintentar solo se
        // vuelven a mandar los que fallaron.
        setError(`No se pudieron transcribir ${failures.length} ${failures.length === 1 ? "tramo" : "tramos"}. ${failures[0]}`);
        return;
      }

      setPhase("closing");
      const closing = await fetch(`/api/hearings/${hearingId}?action=analyze-recording`, { method: "POST" });
      if (!closing.ok) {
        const payload = await closing.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo completar el análisis.");
      }
      router.refresh();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "No se pudo analizar el audio.");
    } finally {
      setRunning(false);
      setPhase("idle");
      router.refresh();
    }
  }, [hearingId, pending, router, runPool, running]);

  if (!parts.length) return null;

  const total = parts.length;
  const ready = total - pending.length;
  const progress = running ? ready + done : ready;

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300">
            <AudioLines className="h-3.5 w-3.5" />
            Grabación de la audiencia
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {total} {total === 1 ? "tramo" : "tramos"} de audio
            {pending.length === 0 ? " · transcripción completa" : ` · faltan transcribir ${pending.length}`}
          </p>
          {pending.length > 0 && !running ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Al analizar se genera la transcripción y, con ella, los cruces con las normas, el resumen y las conclusiones. Puede tardar
              varios minutos: no cierres esta pestaña mientras corre.
            </p>
          ) : null}
        </div>

        {pending.length > 0 ? (
          <button
            type="button"
            onClick={analyze}
            disabled={running}
            className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {running
              ? phase === "closing"
                ? "Cruzando con las normas…"
                : `Transcribiendo ${progress} de ${total}…`
              : failed.length
                ? "Reintentar análisis"
                : "Analizar audio"}
          </button>
        ) : null}
      </div>

      {running || progress < total ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-400 transition-all duration-500"
            style={{ width: `${total ? Math.round((progress / total) * 100) : 0}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-black text-amber-100">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-amber-100/80">
            Lo que ya se transcribió quedó guardado: al reintentar se mandan solo los tramos que faltan.
          </p>
        </div>
      ) : null}
    </section>
  );
}
