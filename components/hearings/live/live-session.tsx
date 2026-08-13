"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, LogOut, Square, TriangleAlert } from "lucide-react";
import { HearingFields } from "@/components/hearings/live/hearing-fields";
import { GuidedTour, TourButton, useGuidedTour, type TourStep } from "@/components/help/guided-tour";
import { NotesCanvas } from "@/components/hearings/live/notes-canvas";
import { clearPendingParts } from "@/components/hearings/live/pending-audio-store";
import { RecorderPanel } from "@/components/hearings/live/recorder-panel";
import { useAudioUpload } from "@/components/hearings/live/use-audio-upload";
import { useRecorder } from "@/components/hearings/live/use-recorder";
import { emptyHearingFicha, type HearingFicha } from "@/lib/hearings/shared";

const AUTOSAVE_INTERVAL_MS = 60_000;

/**
 * Recorrido guiado de la sesion en vivo. CORTO a proposito: quien lo ve por
 * primera vez suele estar por arrancar una audiencia real, con gente esperando.
 * Cinco pasos, lo esencial para operar sin miedo, y listo.
 */
const LIVE_TOUR: TourStep[] = [
  {
    title: "La sesión en vivo",
    body: "Desde acá se registra la audiencia mientras ocurre. Lo esencial: grabar el audio, anotar lo que la grabación no capta, y cerrar. La transcripción se genera después, con un botón, desde el detalle."
  },
  {
    anchor: "grabadora",
    title: "Grabar es lo único crítico",
    body: "«Comenzar a grabar» pide el micrófono y arranca. El audio se sube solo cada 5 minutos: fijate que el medidor se mueva cuando se habla y que el contador de tramos guardados avance. Mientras eso pase, la audiencia está a salvo."
  },
  {
    anchor: "notas",
    title: "Tus notas, aparte del acta",
    body: "Anotá quién habla, los momentos clave, lo que el audio solo no va a poder decir. Se guardan cada minuto y no se mezclan con la transcripción: son tu registro de sala."
  },
  {
    anchor: "ficha",
    title: "La ficha, si hay tiempo",
    body: "Los datos estructurados de la audiencia. Se pueden completar acá o después, desde el detalle: nada de esto frena la grabación."
  },
  {
    title: "Al terminar",
    body: "«Finalizar audiencia» corta la grabación, espera a que todo el audio esté arriba y cierra. Si falta subir algo, te avisa antes. Después, en el detalle, «Analizar audio» genera el acta completa."
  }
];

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
  initialFicha,
  recordedParts = 0,
  firstPartIndex = 0,
  baseOffsetMs = 0
}: {
  meetingId: string;
  title: string;
  aiAvailable?: boolean;
  initialNotes?: string;
  initialFicha?: HearingFicha;
  /** Tramos ya subidos en sesiones anteriores de esta misma audiencia. */
  recordedParts?: number;
  /** Numero del proximo tramo: si volviera a arrancar en 0 pisaria lo ya subido. */
  firstPartIndex?: number;
  /** Donde termina lo ya grabado, para que los tiempos no se solapen al retomar. */
  baseOffsetMs?: number;
}) {
  const router = useRouter();
  const tour = useGuidedTour("audiencias-en-vivo");

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

  // Punto de reanudacion de la grabacion: arranca con lo que sabe el server
  // (tramos ya subidos) y se corre hacia adelante si la recuperacion encuentra
  // tramos pendientes en IndexedDB con indices mas altos. En un ref y no en
  // estado: lo lee la grabadora en el momento de arrancar, no re-renderiza.
  const resumePointRef = useRef({ index: firstPartIndex, offsetMs: baseOffsetMs });
  const upload = useAudioUpload({
    meetingId,
    alreadyUploaded: recordedParts,
    onRecovered: (parts) => {
      for (const part of parts) {
        resumePointRef.current = {
          index: Math.max(resumePointRef.current.index, part.index + 1),
          offsetMs: Math.max(resumePointRef.current.offsetMs, part.offsetMs + part.durationMs)
        };
      }
      // El reloj tambien: los tramos rescatados son audio grabado, y sin esto
      // marcaba menos tiempo del real por el resto de la sesion (el operador
      // que anota "minuto 43" apuntaba a otro momento de la transcripcion).
      recordedMsRef.current = Math.max(recordedMsRef.current, resumePointRef.current.offsetMs);
    }
  });
  // enqueue es estable (useCallback sin dependencias), asi que la grabadora no
  // se reconstruye en cada render.
  const recorder = useRecorder({ onPart: upload.enqueue, nextPart: () => resumePointRef.current });

  /* --------------------------- Cronometro grabado -------------------------- */
  // Cuenta el tiempo GRABADO, no el tiempo en pantalla: si el operador detiene y
  // reanuda, el reloj retoma donde iba en vez de mentir.
  // Arranca en lo ya grabado: el reloj de una audiencia retomada tiene que
  // seguir donde iba, no volver a 00:00.
  const recordedMsRef = useRef(baseOffsetMs);
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
      if (!allUp)
        setFinalizeError(
          "Quedaron tramos de audio sin subir y la grabación quedó detenida. No cierres esta pestaña: se sigue reintentando. Si la audiencia continúa, apretá «Reanudar grabación» (la numeración sigue sola, no pisa nada)."
        );
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

      // El estado se lee DESPUES de esperar al flush y sin pasar por el render:
      // el ultimo tramo se encola recien dentro de recorder.stop(), asi que los
      // valores que capturo el closure de este click ya son viejos y llegaron a
      // decir "quedaron 0 tramos sin subir" con uno pendiente en pantalla.
      const queue = upload.snapshot();

      // Dos motivos para frenar antes de cerrar, ambos salvables por el
      // operador con una segunda pulsada: falta subir audio, o no hay audio.
      if (!confirmFinalize) {
        if (!allUp) {
          setFinalizeError(
            `Quedaron ${queue.pending} ${queue.pending === 1 ? "tramo" : "tramos"} de audio sin subir y se siguen reintentando. Si cerrás ahora, la audiencia queda cerrada sin ese audio (la copia local se conserva en esta computadora para rescatarla). Volvé a apretar para cerrar igual.`
          );
          setConfirmFinalize(true);
          setFinalizing(false);
          return;
        }
        if (queue.uploaded === 0) {
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
      // Las copias locales se sueltan SOLO si todo el audio llego al servidor.
      // Si el operador eligio cerrar con tramos sin subir, esas copias son lo
      // unico que queda de ese audio: borrarlas convierte una perdida avisada
      // en una definitiva, y son justo las que permitieron rescatar la IX
      // Audiencia. Unos MB de disco valen menos que audio de audiencia publica.
      if (allUp) await clearPendingParts(meetingId);
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
          <TourButton onClick={tour.start} />
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

      <div data-tour="grabadora">
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
          recovered={upload.recovered}
          recovering={upload.recovering}
          onStart={() => void recorder.start()}
          onStop={() => void recorder.stop()}
        />
      </div>

      <div data-tour="notas">
        <NotesCanvas value={notes} onChange={setNotes} />
      </div>

      {/* La ficha se completa a mano: sin transcripcion en el momento, Migue no
          tiene de donde sacarla. Vuelve a poder completarse desde el detalle,
          una vez analizado el audio. */}
      <div data-tour="ficha">
        <HearingFields
          value={ficha}
          disabled={finalizing}
          aiAvailable={false}
          completing={false}
          error=""
          onChange={setFicha}
          onCompleteWithAi={() => {}}
        />
      </div>

      <p className="text-xs leading-5 text-slate-500">
        El audio se graba en tramos y se sube solo mientras la audiencia transcurre; las notas y la ficha se guardan cada minuto y al salir.
        La transcripción, los cruces con las normas y las conclusiones se generan después, desde el detalle, con “Analizar audio”.
      </p>

      <GuidedTour steps={LIVE_TOUR} open={tour.open} onClose={tour.close} />
    </div>
  );
}
