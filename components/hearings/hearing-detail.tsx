"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquareText,
  Paperclip,
  Pencil,
  Radio,
  RefreshCw,
  Save,
  Scale,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  X
} from "lucide-react";
import { HearingFields } from "@/components/hearings/live/hearing-fields";
import { ConclusionsFields } from "@/components/hearings/conclusions-fields";
import { HearingDocuments } from "@/components/hearings/hearing-documents";
import {
  emptyHearingConclusions,
  emptyHearingFicha,
  hearingSourceLabels,
  hearingStatusLabels,
  hearingStatusStyles,
  stanceLabels,
  stanceStyles,
  type HearingConclusions,
  type HearingDetail as HearingDetailData,
  type HearingFicha,
  type HearingMatchView
} from "@/lib/hearings/shared";

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatAtMs(atMs: number | null): string {
  if (atMs === null) return "";
  const totalSeconds = Math.floor(atMs / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

type NormGroup = { normId: string; code: string; title: string; articleNumber: string | null; matches: HearingMatchView[] };

/**
 * Detalle de consulta de una audiencia: vista limpia por defecto y "Ver todo el
 * detalle" para desplegar transcripcion, conclusiones, temas, documentos y
 * acciones. Todo en modo lectura (la edicion viene en las Etapas 2 y 3).
 */
export function HearingDetail({
  hearing,
  canEdit = false,
  canDelete = false
}: {
  hearing: HearingDetailData;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  // Se puede continuar dictando aunque sea tema libre (sin código nuevo).
  const canResume = canEdit && (hearing.hearingStatus === "SCHEDULED" || hearing.hearingStatus === "LIVE");

  // Campos de la ficha con contenido, para mostrar solo lo cargado.
  const fichaEntries = (
    [
      ["Temática principal", hearing.ficha.mainTopic],
      ["Temáticas secundarias", hearing.ficha.secondaryTopics],
      ["Propuesta relacionada", hearing.ficha.relatedProposal],
      ["Origen de la propuesta", hearing.ficha.proposalSource],
      ["Autor o área impulsora", hearing.ficha.author],
      ["Artículos del código", hearing.ficha.relatedArticles],
      ["Participantes", hearing.ficha.participants],
      ["Institución", hearing.ficha.institution],
      ["Rol", hearing.ficha.role],
      ["Tipo de actor", hearing.ficha.actorType],
      ["Intervención", hearing.ficha.intervention]
    ] as const
  )
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => ({ label, value }));

  // Conclusiones (foto 2) del expediente unificado: las del equipo si las hay,
  // si no las del ultimo analisis IA.
  const c = hearing.conclusions;
  const conclusionEntries = c
    ? (
        [
          ["Acuerdos alcanzados", c.agreements],
          ["Desacuerdos detectados", c.disagreements],
          ["Próximos pasos", c.nextSteps],
          ["Recomendaciones técnicas", c.technicalRecommendations],
          ["Decisiones tomadas", c.decisions],
          ["Estado posterior de la propuesta", c.proposalStatusAfter],
          ["Temas observados", c.observedTopics],
          ["Importancia de los temas", c.importance],
          ["Observación técnica", c.technicalObservation],
          ["Observación ciudadana", c.citizenObservation]
        ] as const
      )
        .filter(([, value]) => value.trim().length > 0)
        .map(([label, value]) => ({ label, value }))
    : [];
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [retryStarted, setRetryStarted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Audiencia ya transcripta a la que le falta el resumen: el analisis es el
  // ultimo paso de la ingesta y puede haber fallado solo (tipico: quedarse sin
  // credito despues de pagar la transcripcion). Se puede rehacer sin re-ingestar.
  const canGenerateAnalysis = canEdit && hearing.transcriptSegments.length > 0 && !hearing.analysis;

  async function generateAnalysis() {
    setAnalyzeError("");
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/hearings/${hearing.id}/generate-analysis`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo generar el análisis.");
      }
      router.refresh();
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "No se pudo generar el análisis.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function retryIngest() {
    setRetryError("");
    setRetrying(true);
    try {
      const response = await fetch(`/api/hearings/${hearing.id}/retry-ingest`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo reintentar el procesamiento.");
      }
      setRetryStarted(true);
      router.refresh();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "No se pudo reintentar el procesamiento.");
    } finally {
      setRetrying(false);
    }
  }

  // Edicion inline de las fichas. null = seccion en modo lectura.
  const [fichaDraft, setFichaDraft] = useState<HearingFicha | null>(null);
  const [savingFicha, setSavingFicha] = useState(false);
  const [fichaError, setFichaError] = useState("");
  const [conclusionsDraft, setConclusionsDraft] = useState<HearingConclusions | null>(null);
  const [savingConclusions, setSavingConclusions] = useState(false);
  const [conclusionsError, setConclusionsError] = useState("");

  const hasFicha = fichaEntries.length > 0;

  async function saveFicha() {
    if (!fichaDraft) return;
    setFichaError("");
    setSavingFicha(true);
    try {
      const response = await fetch(`/api/hearings/${hearing.id}/ficha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha: fichaDraft })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo guardar la ficha.");
      }
      setFichaDraft(null);
      router.refresh();
    } catch (error) {
      setFichaError(error instanceof Error ? error.message : "No se pudo guardar la ficha.");
    } finally {
      setSavingFicha(false);
    }
  }

  async function saveConclusions() {
    if (!conclusionsDraft) return;
    setConclusionsError("");
    setSavingConclusions(true);
    try {
      const response = await fetch(`/api/hearings/${hearing.id}/conclusions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conclusions: conclusionsDraft })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudieron guardar las conclusiones.");
      }
      setConclusionsDraft(null);
      router.refresh();
    } catch (error) {
      setConclusionsError(error instanceof Error ? error.message : "No se pudieron guardar las conclusiones.");
    } finally {
      setSavingConclusions(false);
    }
  }

  async function remove() {
    if (!window.confirm("¿Eliminar esta audiencia de forma permanente? Se pierden sus cruces, transcripción y análisis.")) return;
    setDeleteError("");
    setDeleting(true);
    try {
      const response = await fetch(`/api/hearings/${hearing.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo eliminar la audiencia.");
      }
      router.push("/audiencias");
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la audiencia.");
      setDeleting(false);
    }
  }

  const matchGroups = useMemo<NormGroup[]>(() => {
    const byNorm = new Map<string, NormGroup>();
    for (const match of hearing.matches) {
      const existing = byNorm.get(match.normId);
      if (existing) existing.matches.push(match);
      else byNorm.set(match.normId, { normId: match.normId, code: match.code, title: match.title, articleNumber: match.articleNumber, matches: [match] });
    }
    return [...byNorm.values()];
  }, [hearing.matches]);

  const hasExtra =
    hearing.transcriptSegments.length > 0 ||
    hearing.actionItems.length > 0 ||
    hearing.mediaFiles.length > 0 ||
    hearing.insights.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Audiencias públicas
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-black leading-tight text-white">{hearing.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[#1f89f6]" />
                {formatDate(hearing.occurredAt)}
              </span>
              {hearing.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#1f89f6]" />
                  {hearing.location}
                </span>
              ) : null}
              {hearing.modality ? <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-bold text-slate-300">{hearing.modality}</span> : null}
              {hearing.hearingSource ? <span className="text-xs text-slate-500">{hearingSourceLabels[hearing.hearingSource]}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${hearingStatusStyles[hearing.hearingStatus]}`}>
              {hearingStatusLabels[hearing.hearingStatus]}
            </span>
            {canResume ? (
              <Link
                href={`/audiencias/${hearing.id}/en-vivo`}
                className="urban-button inline-flex items-center gap-1.5 rounded-md bg-civic-blue px-3 py-1.5 text-xs font-black text-white"
              >
                <Radio className="h-3.5 w-3.5" />
                Continuar en vivo
              </Link>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="urban-button inline-flex items-center gap-1.5 rounded-md border border-rose-300/25 bg-rose-300/10 px-3 py-1.5 text-xs font-bold text-rose-100 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
        {deleteError ? <p className="mt-2 text-xs font-bold text-amber-200">{deleteError}</p> : null}

        {hearing.reformCode ? (
          <Link
            href={hearing.reformId ? `/normas/${hearing.reformId}` : "/normas"}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-sky-300/20 bg-sky-300/[0.06] px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:border-sky-300/40"
          >
            <Scale className="h-3.5 w-3.5" />
            {hearing.reformCode}
            {hearing.reformTitle ? ` · ${hearing.reformTitle}` : ""}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : hearing.topic ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200">
            <MessageSquareText className="h-3.5 w-3.5 text-[#1f89f6]" />
            {hearing.topic}
            <span className="text-[10px] font-normal text-slate-500">· tema libre</span>
          </span>
        ) : null}
      </div>

      {hearing.ingestError || hearing.ingestStalled ? (
        <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {hearing.ingestError ? "El procesamiento del video falló" : "El procesamiento se interrumpió"}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-amber-100/80">
            {hearing.ingestError ??
              "El servidor se detuvo mientras se procesaba el video y el trabajo quedó a medias. Se puede retomar desde acá."}
          </p>
          {retryError ? <p className="mt-2 text-xs font-bold text-rose-200">{retryError}</p> : null}
          {retryStarted ? (
            <p className="mt-2 text-xs font-bold text-emerald-200">Procesamiento relanzado: puede tardar varios minutos. Actualizá la página para ver el avance.</p>
          ) : canEdit ? (
            <button
              type="button"
              onClick={retryIngest}
              disabled={retrying}
              className="urban-button mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/15 px-3 py-1.5 text-xs font-black text-amber-100 disabled:opacity-60"
            >
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {retrying ? "Relanzando…" : "Reintentar procesamiento"}
            </button>
          ) : null}
        </div>
      ) : null}

      {hearing.ingestWarning || canGenerateAnalysis ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {hearing.ingestWarning ? "Esta acta está incompleta" : "Esta audiencia no tiene resumen"}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-amber-100/80">
            {hearing.ingestWarning ??
              "La transcripción y los cruces están guardados, pero falta el resumen de Migue con las conclusiones y los participantes. Se puede generar ahora sin volver a transcribir."}
          </p>
          {analyzeError ? <p className="mt-2 text-xs font-bold text-rose-200">{analyzeError}</p> : null}
          {canGenerateAnalysis ? (
            <button
              type="button"
              onClick={generateAnalysis}
              disabled={analyzing}
              className="urban-button mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/15 px-3 py-1.5 text-xs font-black text-amber-100 disabled:opacity-60"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analyzing ? "Analizando el debate…" : "Generar análisis"}
            </button>
          ) : null}
        </div>
      ) : null}

      {hearing.description ? (
        <Section title="Descripción">
          <p className="text-sm leading-7 text-slate-300">{hearing.description}</p>
        </Section>
      ) : null}

      {fichaDraft ? (
        <div>
          <HearingFields
            value={fichaDraft}
            disabled={savingFicha}
            aiAvailable={false}
            completing={false}
            error=""
            onChange={setFichaDraft}
            onCompleteWithAi={() => {}}
          />
          <EditActions saving={savingFicha} error={fichaError} onCancel={() => setFichaDraft(null)} onSave={saveFicha} />
        </div>
      ) : hasFicha ? (
        <Section
          title="Ficha de la audiencia"
          icon={ClipboardList}
          action={canEdit ? <EditButton label="Editar ficha" onClick={() => setFichaDraft(hearing.ficha)} /> : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {fichaEntries.map((entry) => (
              <Field key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </div>
        </Section>
      ) : canEdit ? (
        <Section title="Ficha de la audiencia" icon={ClipboardList}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">Todavía no se cargó la ficha de datos de esta audiencia.</p>
            <button
              type="button"
              onClick={() => setFichaDraft(emptyHearingFicha())}
              className="urban-button inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200"
            >
              <Pencil className="h-3.5 w-3.5" />
              Cargar ficha
            </button>
          </div>
        </Section>
      ) : null}

      {hearing.analysis ? (
        <Section
          title="Resumen del análisis"
          icon={Sparkles}
          badge={hearing.analysis.editedByHuman ? "Revisado por el equipo" : undefined}
        >
          <p className="whitespace-pre-line text-sm leading-7 text-slate-300">{hearing.analysis.summary}</p>
          {hearing.analysis.topics.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hearing.analysis.topics.map((topic, index) => (
                <span key={index} className="rounded bg-sky-400/10 px-2 py-0.5 text-[11px] font-bold text-sky-200">{topic}</span>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {conclusionsDraft ? (
        <Section title="Conclusiones y temas observados" icon={Sparkles}>
          <ConclusionsFields value={conclusionsDraft} disabled={savingConclusions} onChange={setConclusionsDraft} />
          <EditActions saving={savingConclusions} error={conclusionsError} onCancel={() => setConclusionsDraft(null)} onSave={saveConclusions} />
        </Section>
      ) : conclusionEntries.length ? (
        <Section
          title="Conclusiones y temas observados"
          icon={Sparkles}
          badge={hearing.conclusionsByTeam ? "Firmadas por el equipo" : "Borrador de Migue"}
          action={canEdit ? <EditButton label="Editar conclusiones" onClick={() => setConclusionsDraft(c ?? emptyHearingConclusions())} /> : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {conclusionEntries.map((entry) => (
              <Field key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </div>
        </Section>
      ) : canEdit ? (
        <Section title="Conclusiones y temas observados" icon={Sparkles}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">Todavía no se cargaron las conclusiones de esta audiencia.</p>
            <button
              type="button"
              onClick={() => setConclusionsDraft(emptyHearingConclusions())}
              className="urban-button inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200"
            >
              <Pencil className="h-3.5 w-3.5" />
              Cargar conclusiones
            </button>
          </div>
        </Section>
      ) : null}

      {matchGroups.length ? (
        <Section title="Cruce con el código nuevo" icon={Scale} badge={`${matchGroups.length} ${matchGroups.length === 1 ? "norma" : "normas"}`}>
          <div className="grid gap-2">
            {matchGroups.map((group) => (
              <div key={group.normId} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      {group.code}
                      {group.articleNumber ? ` · Art. ${group.articleNumber}` : ""}
                    </span>
                    <h3 className="text-sm font-black leading-5 text-white">{group.title}</h3>
                  </div>
                  {hearing.reformId ? (
                    <a
                      href={`/normas/${hearing.reformId}/${group.normId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-slate-500 transition hover:text-sky-300"
                      title="Abrir la norma"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-2">
                  {group.matches.map((match) => (
                    <div key={match.id} className="rounded-md border border-white/8 bg-slate-950/40 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${stanceStyles[match.stance]}`}>{stanceLabels[match.stance]}</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Confianza {Math.round(match.confidence * 100)}%
                          {match.atMs !== null ? ` · ${formatAtMs(match.atMs)}` : ""}
                        </span>
                      </div>
                      <p className="mt-1.5 border-l-2 border-[#f6d500] pl-2 text-xs italic leading-5 text-slate-300">“{match.fragment}”</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {hearing.participants.length ? (
        <Section title="Participantes" icon={Users} badge={String(hearing.participants.length)}>
          <div className="flex flex-wrap gap-2">
            {hearing.participants.map((participant) => (
              <span key={participant.id} className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-slate-200">
                {participant.displayName}
                {participant.role ? <span className="ml-1.5 font-normal text-slate-500">· {participant.role}</span> : null}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <HearingDocuments hearingId={hearing.id} documents={hearing.documents} canEdit={canEdit} />

      {hasExtra ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-200"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Ocultar el detalle" : "Ver todo el detalle"}
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="space-y-4">
          {hearing.insights.length ? (
            <Section title="Temas observados">
              <div className="grid gap-2">
                {hearing.insights.map((insight) => (
                  <div key={insight.id} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-sm font-black text-white">{insight.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{insight.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {hearing.actionItems.length ? (
            <Section title="Acciones" icon={CheckCircle2}>
              <ul className="grid gap-2">
                {hearing.actionItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>
                      {item.title}
                      {item.assignee ? <span className="ml-1.5 text-slate-500">· {item.assignee}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {hearing.mediaFiles.length ? (
            <Section title="Archivos multimedia" icon={Paperclip}>
              <div className="grid gap-2">
                {hearing.mediaFiles.map((media) => (
                  <span key={media.id} className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-200">
                    <Paperclip className="h-3.5 w-3.5 text-[#1f89f6]" />
                    {media.fileName}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}

          {hearing.transcriptSegments.length ? (
            <Section title="Transcripción" icon={FileText} badge={`${hearing.transcriptSegments.length} segmentos`}>
              <div className="urban-scrollbar max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {hearing.transcriptSegments.map((segment) => (
                  <p key={segment.id} className="text-sm leading-7 text-slate-300">
                    {segment.speakerLabel ? <span className="mr-2 font-bold text-sky-200">{segment.speakerLabel}:</span> : null}
                    {segment.content}
                  </p>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  badge,
  action,
  children
}: {
  title: string;
  icon?: typeof Scale;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black text-white">
          {Icon ? <Icon className="h-4 w-4 text-[#1f89f6]" /> : null}
          {title}
        </p>
        <div className="flex items-center gap-2">
          {badge ? <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-black text-sky-200">{badge}</span> : null}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Botón chico para entrar en modo edición desde el header de una sección. */
function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="urban-button inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-slate-200"
    >
      <Pencil className="h-3 w-3" />
      {label}
    </button>
  );
}

/** Barra Guardar/Cancelar compartida por los editores inline de fichas. */
function EditActions({ saving, error, onCancel, onSave }: { saving: boolean; error: string; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-4">
      {error ? <p className="mb-2 text-xs font-bold text-amber-200">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2 text-xs font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="urban-button inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}
