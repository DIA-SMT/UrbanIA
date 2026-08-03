"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, LogOut, Square, TriangleAlert } from "lucide-react";
import { HearingFields } from "@/components/hearings/live/hearing-fields";
import { NotesCanvas } from "@/components/hearings/live/notes-canvas";
import { RecorderPanel } from "@/components/hearings/live/recorder-panel";
import { useAudioUpload } from "@/components/hearings/live/use-audio-upload";
import { useRecorder } from "@/components/hearings/live/use-recorder";
import { emptyHearingFicha, type HearingFicha } from "@/lib/hearings/shared";

const AUTOSAVE_INTERVAL_MS = 60_000;

/**
 * Sesion en vivo de una audiencia (ruta /audiencias/[id]/en-vivo).
 *
 * La audiencia se GRABA; la transcripcion se genera despues, desde el detalle,
 * con "Analizar audio". Mientras tanto el operador anota a mano y completa la
 * Ficha 1. Antes esta pantalla dictaba con la Web Speech API y macheaba el
 * texto contra las mininormas en vivo; los dos se fueron con el dictado, porque
 * dependian de tener texto en el momento.
 *
 * Lo unico irrecuperable de una audiencia es el audio: por eso el cierre no
 * avanza mientras queden tramos sin subir, y salir de la pantalla corta la
 * grabacion a proposito en vez de dejarla en un limbo.
 */
export function LiveSession({
  meetingId,
  title,
  initialNotes = "",
  initialFicha
}: {
  meetingId: string;
  title: string;
  aiAvailable?: boolean;
  initialNotes?: string;
  initialFicha?: HearingFicha;
}) {
  const router = useRouter();

  const [notes, setNotes] = useState(initialNotes);
  const [ficha, setFicha] = useState<HearingFicha>(initialFicha ?? emptyHearingFicha());
  const [elapsedLabel, setElapsedLabel] = useState("00:00");
  const [savedLabel, setSavedLabel] = useState(initialNotes.trim() ? "Notas recuperadas" : "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
  /** Segunda pulsada: cerrar aunque falte audio. La primera protege, la segunda respeta la decision. */
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [exiting, setExiting] = useState(false);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const fichaRef = useRef(ficha);
  fichaRef.current = ficha;
  const lastSavedRef = useRef("");
  const savingRef = useRef(false);

  const upload = useAudioUpload({ meetingId });
  // enqueue es estable (useCallback sin dependencias), asi que la grabadora no
  // se reconstruye en cada render.
  const recorder = useRecorder({ onPart: upload.enqueue });

  /* --------------------------- Cronometro grabado -------------------------- */
  // Cuenta el tiempo GRABADO, no el tiempo en pantalla: si el operador detiene y
  // reanuda, el reloj retoma donde iba en vez de mentir.
  const recordedMsRef = useRef(0);
  const recordingSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (recorder.recording && recordingSinceRef.current === null) {
      recordingSinceRef.current = Date.now();
    } else if (!recorder.recording && recordingSinceRef.current !== null) {
      recordedMsRef.current += Date.now() - recordingSinceRef.current;
      recordingSinceRef.current = null;
    }
  }, [recorder.recording]);

  useEffect(() => {
    const interval = setInterval(() => {
      const live = recordingSinceRef.current ? Date.now() - recordingSinceRef.current : 0;
      const total = Math.floor((recordedMsRef.current + live) / 1000);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setElapsedLabel(hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* ------------------------------ Autoguardado ----------------------------- */

  /**
   * Guarda notas + ficha. Devuelve si el servidor CONFIRMO: la firma se marca
   * solo en ese caso, para que un rechazo (sesion vencida, error de base) no
   * quede mostrando "Guardado" mientras se pierde lo escrito.
   */
  const saveDraft = useCallback(
    async (options: { force?: boolean; keepalive?: boolean } = {}): Promise<boolean> => {
      const currentNotes = notesRef.current;
      const currentFicha = fichaRef.current;
      const signature = `${currentNotes} ${JSON.stringify(currentFicha)}`;
      if (!options.force && signature === lastSavedRef.current) return true;
      if (currentNotes.trim().length === 0 && !Object.values(currentFicha).some((value) => value.trim().length > 0)) return true;
      if (savingRef.current) return false;

      savingRef.current = true;
      setSaving(true);
      try {
        const response = await fetch(`/api/hearings/${meetingId}?action=draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: currentNotes, ficha: currentFicha }),
          keepalive: options.keepalive ?? false
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || payload?.error || `El servidor rechazó el guardado (${response.status}).`);
        }
        lastSavedRef.current = signature;
        const now = new Date();
        setSavedLabel(`Guardado ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
        setSaveError("");
        return true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "No se pudieron guardar las notas.");
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [meetingId]
  );

  useEffect(() => {
    const interval = setInterval(() => void saveDraft(), AUTOSAVE_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void saveDraft({ keepalive: true });
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [saveDraft]);

  // Cerrar la pestana grabando (o con tramos en la cola) pierde audio que no se
  // recupera. El navegador muestra su propio cartel de confirmacion.
  const recordingOrPending = recorder.recording || upload.pending > 0;
  useEffect(() => {
    if (!recordingOrPending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [recordingOrPending]);

  /* -------------------------------- Acciones ------------------------------- */

  /** Corta la grabacion y espera a que todo el audio este arriba. */
  const stopAndFlush = useCallback(async (): Promise<boolean> => {
    await recorder.stop();
    return upload.flush();
  }, [recorder, upload]);

  async function saveAndExit() {
    if (exiting || finalizing) return;
    setExiting(true);
    // Salir de la pantalla mata la grabacion igual: mejor cortarla ordenada y
    // subir lo que falte antes de irse.
    const allUp = await stopAndFlush();
    const saved = await saveDraft({ force: true });
    if (!saved || !allUp) {
      setExiting(false);
      if (!allUp) setFinalizeError("Quedaron tramos de audio sin subir. No cierres esta pestaña: se sigue reintentando.");
      return;
    }
    router.push(`/audiencias/${meetingId}`);
  }

  async function finalize() {
    if (finalizing) return;
    setFinalizing(true);
    setFinalizeError("");
    try {
      const allUp = await stopAndFlush();
      await saveDraft({ force: true });

      // Dos motivos para frenar antes de cerrar, ambos salvables por el
      // operador con una segunda pulsada: falta subir audio, o no hay audio.
      if (!confirmFinalize) {
        if (!allUp) {
          setFinalizeError(
            `Quedaron ${upload.pending} ${upload.pending === 1 ? "tramo" : "tramos"} de audio sin subir y se siguen reintentando. Si cerrás ahora, ese audio se pierde. Volvé a apretar para cerrar igual.`
          );
          setConfirmFinalize(true);
          setFinalizing(false);
          return;
        }
        if (upload.uploaded === 0) {
          setFinalizeError("No se grabó audio en esta audiencia, así que no va a haber nada para transcribir. Volvé a apretar para cerrar igual.");
          setConfirmFinalize(true);
          setFinalizing(false);
          return;
        }
      }

      const response = await fetch(`/api/hearings/${meetingId}?action=finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesRef.current })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo finalizar la audiencia.");
      }
      router.push(`/audiencias/${meetingId}`);
    } catch (error) {
      setFinalizeError(error instanceof Error ? error.message : "No se pudo finalizar la audiencia.");
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/audiencias/${meetingId}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Detalle de la audiencia
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300">
            Audiencia en vivo
            <span className="inline-flex items-center gap-1 text-[11px] font-bold normal-case tracking-normal text-slate-500">
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : saveError ? (
                <TriangleAlert className="h-3 w-3 text-amber-300" />
              ) : savedLabel ? (
                <Check className="h-3 w-3 text-emerald-300" />
              ) : null}
              {saving ? "Guardando…" : saveError ? <span className="text-amber-200">Sin guardar</span> : savedLabel}
            </span>
          </p>
          <h1 className="mt-1 truncate text-2xl font-black leading-tight text-white">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveAndExit}
            disabled={finalizing || exiting}
            className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:opacity-60"
          >
            {exiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {exiting ? "Guardando…" : "Guardar y salir"}
          </button>
          <button
            type="button"
            onClick={finalize}
            disabled={finalizing || exiting}
            className={`urban-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
              confirmFinalize ? "bg-amber-500" : "bg-civic-blue"
            }`}
          >
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            {finalizing ? "Cerrando…" : confirmFinalize ? "Finalizar igual" : "Finalizar audiencia"}
          </button>
        </div>
      </div>

      {finalizeError ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm font-black text-amber-100">Antes de cerrar</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">{finalizeError}</p>
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Las notas no se están guardando
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            {saveError} El audio se sigue subiendo por su cuenta. Si la sesión venció, entrá con tu cuenta en otra pestaña y volvé.
          </p>
        </div>
      ) : null}

      <RecorderPanel
        supported={recorder.supported}
        recording={recorder.recording}
        starting={recorder.starting}
        error={recorder.error}
        level={recorder.level}
        elapsedLabel={elapsedLabel}
        uploaded={upload.uploaded}
        pending={upload.pending}
        stuck={upload.stuck}
        uploadError={upload.error}
        onStart={() => void recorder.start()}
        onStop={() => void recorder.stop()}
      />

      <NotesCanvas value={notes} onChange={setNotes} />

      {/* La ficha se completa a mano: sin transcripcion en el momento, Migue no
          tiene de donde sacarla. Vuelve a poder completarse desde el detalle,
          una vez analizado el audio. */}
      <HearingFields
        value={ficha}
        disabled={finalizing}
        aiAvailable={false}
        completing={false}
        error=""
        onChange={setFicha}
        onCompleteWithAi={() => {}}
      />

      <p className="text-xs leading-5 text-slate-500">
        El audio se graba en tramos y se sube solo mientras la audiencia transcurre; las notas y la ficha se guardan cada minuto y al salir.
        La transcripción, los cruces con las normas y las conclusiones se generan después, desde el detalle, con “Analizar audio”.
      </p>
    </div>
  );
}
