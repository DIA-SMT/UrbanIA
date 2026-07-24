"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, LogOut, Square, TriangleAlert } from "lucide-react";
import { TranscriptCanvas } from "@/components/hearings/live/transcript-canvas";
import { MatchesPanel } from "@/components/hearings/live/matches-panel";
import { HearingFields } from "@/components/hearings/live/hearing-fields";
import { ClosingReview } from "@/components/hearings/live/closing-review";
import { useDictation } from "@/components/hearings/live/use-dictation";
import {
  emptyHearingConclusions,
  emptyHearingFicha,
  type HearingConclusions,
  type HearingFicha,
  type HearingMatchView
} from "@/lib/hearings/shared";

const MATCH_DEBOUNCE_MS = 10_000;
const MATCH_MIN_NEW_CHARS = 300;
const MATCH_WINDOW_CHARS = 1500;
const AUTOSAVE_INTERVAL_MS = 60_000;

/**
 * Sesion en vivo sobre una audiencia ya creada (ruta /audiencias/[id]/en-vivo).
 * Dictado con la Web Speech API sobre un lienzo editable, macheo periodico del
 * ultimo tramo contra las mininormas, autoguardado del borrador cada minuto
 * (y al salir/ocultar la pestana) para poder retomar despues, y cierre que
 * finaliza y lleva al detalle. Los cruces son sugerencias de Migue.
 */
export function LiveSession({
  meetingId,
  title,
  reformId,
  aiAvailable,
  initialTranscript = "",
  initialMatches = [],
  initialFicha
}: {
  meetingId: string;
  title: string;
  reformId: string | null;
  aiAvailable: boolean;
  initialTranscript?: string;
  initialMatches?: HearingMatchView[];
  initialFicha?: HearingFicha;
}) {
  const router = useRouter();
  const resuming = initialTranscript.trim().length > 0;
  // Sin codigo nuevo (tema libre) no hay contra que cruzar: se desactiva el macheo.
  const matchingEnabled = aiAvailable && Boolean(reformId);

  const [transcript, setTranscript] = useState(initialTranscript);
  const [matches, setMatches] = useState<HearingMatchView[]>(initialMatches);
  const [ficha, setFicha] = useState<HearingFicha>(initialFicha ?? emptyHearingFicha());
  const [elapsedLabel, setElapsedLabel] = useState("00:00");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
  const [savedLabel, setSavedLabel] = useState(resuming ? "Borrador recuperado" : "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [fichaError, setFichaError] = useState("");

  // Fase de cierre: "live" (dictado) -> "review" (revisar conclusiones de Migue).
  const [phase, setPhase] = useState<"live" | "review">("live");
  const [conclusions, setConclusions] = useState<HearingConclusions>(emptyHearingConclusions());
  const [closingError, setClosingError] = useState("");

  const startedAtRef = useRef<number>(Date.now());
  const lastSentLengthRef = useRef(initialTranscript.length);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const transcriptRef = useRef(initialTranscript);
  transcriptRef.current = transcript;
  const fichaRef = useRef(ficha);
  fichaRef.current = ficha;
  const lastSavedRef = useRef("");
  const savingRef = useRef(false);

  const appendFinalText = useCallback((text: string) => {
    setTranscript((current) => current + text);
  }, []);

  const dictation = useDictation({ onFinalText: appendFinalText });

  // Arranca el dictado al montar solo si es una audiencia nueva (sin borrador).
  // Al reanudar no se arranca solo: el operador revisa y toca "Reanudar dictado".
  const dictationStartRef = useRef(dictation.start);
  dictationStartRef.current = dictation.start;
  useEffect(() => {
    startedAtRef.current = Date.now();
    if (!resuming) dictationStartRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const totalSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setElapsedLabel(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Guarda el borrador (transcripcion + ficha). keepalive para que salga al
   * cerrar. Devuelve si el servidor CONFIRMO el guardado: la firma se marca
   * solo en ese caso, para que un rechazo (sesion vencida, payload invalido,
   * error de base) no quede mostrando "Guardado" mientras se pierde el dictado.
   */
  const saveDraft = useCallback(
    async (options: { force?: boolean; keepalive?: boolean } = {}): Promise<boolean> => {
      const text = transcriptRef.current;
      const currentFicha = fichaRef.current;
      const signature = `${text} ${JSON.stringify(currentFicha)}`;
      if (!options.force && signature === lastSavedRef.current) return true;
      // Nada que guardar todavia: ni transcripcion ni ficha con contenido.
      if (text.trim().length === 0 && !Object.values(currentFicha).some((v) => v.trim().length > 0)) return true;
      // Un solo POST a la vez: antes lo cubria marcar la firma por adelantado.
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        const response = await fetch(`/api/hearings/${meetingId}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, ficha: currentFicha }),
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
        // Sin marcar la firma: el proximo ciclo reintenta con el mismo contenido.
        setSaveError(error instanceof Error ? error.message : "No se pudo guardar el borrador.");
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [meetingId]
  );

  // Autoguardado periodico + al ocultar/cerrar la pestana.
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

  /** Manda el ultimo tramo (no todo el historial) al macheo en vivo. */
  const sendMatchWindow = useCallback(async () => {
    if (sendingRef.current) return;
    const fullText = transcriptRef.current;
    const window = fullText.slice(-MATCH_WINDOW_CHARS).trim();
    if (window.length < 20) return;

    sendingRef.current = true;
    lastSentLengthRef.current = fullText.length;
    try {
      const response = await fetch(`/api/hearings/${meetingId}/live-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window, atMs: Date.now() - startedAtRef.current })
      });
      if (response.ok) {
        const payload = (await response.json()) as { matches: HearingMatchView[] };
        if (payload.matches.length) {
          setMatches((current) => {
            const known = new Set(current.map((match) => match.id));
            return [...payload.matches.filter((match) => !known.has(match.id)), ...current];
          });
        }
      }
    } catch {
      // El macheo es best-effort: un tramo perdido se recupera en el proximo.
    } finally {
      sendingRef.current = false;
    }
  }, [meetingId]);

  // Disparo del macheo: cada ~10 s o ~300 caracteres nuevos, lo que ocurra antes.
  useEffect(() => {
    if (!matchingEnabled) return;
    const newChars = transcript.length - lastSentLengthRef.current;
    if (newChars <= 0) return;

    if (newChars >= MATCH_MIN_NEW_CHARS) {
      if (matchTimerRef.current) {
        clearTimeout(matchTimerRef.current);
        matchTimerRef.current = null;
      }
      void sendMatchWindow();
      return;
    }

    if (!matchTimerRef.current) {
      matchTimerRef.current = setTimeout(() => {
        matchTimerRef.current = null;
        void sendMatchWindow();
      }, MATCH_DEBOUNCE_MS);
    }
  }, [matchingEnabled, transcript, sendMatchWindow]);

  useEffect(
    () => () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    },
    []
  );

  /** Completa con IA los campos VACIOS de la ficha, sin pisar lo cargado a mano. */
  async function completeFichaWithAi() {
    setFichaError("");
    const text = transcript.trim();
    if (text.length < 40) {
      setFichaError("Dictá o escribí un poco más para que Migue pueda completar.");
      return;
    }
    setCompleting(true);
    try {
      const response = await fetch(`/api/hearings/${meetingId}/complete-ficha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo completar la ficha.");
      const extracted = payload.ficha as Partial<HearingFicha>;
      setFicha((current) => {
        const next = { ...current };
        (Object.keys(extracted) as (keyof HearingFicha)[]).forEach((key) => {
          const value = extracted[key];
          // Solo campos vacios: no se pisa lo que el operador ya escribio.
          if (value && next[key].trim().length === 0) next[key] = value;
        });
        return next;
      });
    } catch (completeError) {
      setFichaError(completeError instanceof Error ? completeError.message : "No se pudo completar la ficha.");
    } finally {
      setCompleting(false);
    }
  }

  async function saveAndExit() {
    dictation.stop();
    // Si el servidor rechazo el guardado NO se navega: salir de la pantalla
    // perderia el dictado. El error queda visible y se puede reintentar.
    const saved = await saveDraft({ force: true });
    if (!saved) return;
    router.push(`/audiencias/${meetingId}`);
  }

  /** Guarda la audiencia con la transcripcion (y conclusiones revisadas, si hay). */
  const saveFinal = useCallback(
    async (reviewed: HearingConclusions | null) => {
      const fullText = transcriptRef.current.trim();
      const response = await fetch(`/api/hearings/${meetingId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullText, ...(reviewed ? { conclusions: reviewed } : {}) })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo finalizar la audiencia.");
      }
    },
    [meetingId]
  );

  /** "Finalizar": Migue redacta las conclusiones y se pasa a revisarlas. Sin IA, cierra directo. */
  async function startClosing() {
    const fullText = transcript.trim();
    if (fullText.length < 20) {
      setFinalizeError("La transcripción es demasiado corta para cerrar (mínimo 20 caracteres).");
      return;
    }
    setFinalizeError("");
    setFinalizing(true);
    dictation.stop();
    if (matchTimerRef.current) {
      clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    try {
      await saveDraft({ force: true });
      if (!aiAvailable) {
        // Sin IA no hay conclusiones para revisar: se cierra directo.
        await saveFinal(null);
        router.push(`/audiencias/${meetingId}`);
        return;
      }
      const response = await fetch(`/api/hearings/${meetingId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullText })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo analizar la audiencia.");
      setConclusions(payload.conclusions as HearingConclusions);
      setClosingError("");
      setPhase("review");
    } catch (closeFailure) {
      setFinalizeError(closeFailure instanceof Error ? closeFailure.message : "No se pudo cerrar la audiencia.");
    } finally {
      setFinalizing(false);
    }
  }

  /** "Guardar y cerrar" desde la revision: persiste las conclusiones editadas. */
  async function saveClose() {
    setClosingError("");
    setSaving(true);
    try {
      await saveFinal(conclusions);
      router.push(`/audiencias/${meetingId}`);
    } catch (saveFailure) {
      setClosingError(saveFailure instanceof Error ? saveFailure.message : "No se pudo guardar la audiencia.");
      setSaving(false);
    }
  }

  if (phase === "review") {
    return <ClosingReview value={conclusions} saving={saving} error={closingError} onChange={setConclusions} onBack={() => setPhase("live")} onSave={saveClose} />;
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
          {finalizeError ? <span className="text-xs font-bold text-amber-200">{finalizeError}</span> : null}
          <button
            type="button"
            onClick={saveAndExit}
            disabled={finalizing}
            className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            Guardar y salir
          </button>
          <button
            type="button"
            onClick={startClosing}
            disabled={finalizing}
            className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            {finalizing ? (aiAvailable ? "Analizando el debate..." : "Guardando...") : "Finalizar audiencia"}
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            El dictado no se está guardando
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            {saveError} No cierres esta pantalla: se sigue reintentando cada minuto y el texto está intacto acá. Si la sesión venció, entrá con tu cuenta en otra pestaña y volvé.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <TranscriptCanvas
          value={transcript}
          interim={dictation.interim}
          recording={dictation.recording}
          supported={dictation.supported}
          dictationError={dictation.error}
          elapsedLabel={elapsedLabel}
          onChange={setTranscript}
          onToggleDictation={() => (dictation.recording ? dictation.stop() : dictation.start())}
        />
        <MatchesPanel matches={matches} reformId={reformId} aiAvailable={aiAvailable} />
      </div>

      <HearingFields
        value={ficha}
        disabled={finalizing}
        aiAvailable={aiAvailable}
        completing={completing}
        error={fichaError}
        onChange={setFicha}
        onCompleteWithAi={completeFichaWithAi}
      />

      <p className="text-xs leading-5 text-slate-500">
        El borrador se guarda solo cada minuto y cuando salís: podés cerrar y retomar la audiencia desde su detalle. El dictado usa el reconocimiento de voz del navegador. Los cruces con las normas son sugerencias de Migue; no deciden nada.
      </p>
    </div>
  );
}
