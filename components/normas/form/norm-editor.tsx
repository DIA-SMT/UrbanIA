"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MunicipalArea, ProjectStatus } from "@prisma/client";
import { ArrowLeft, FileDown, Loader2, Save, Send, Trash2 } from "lucide-react";
import { FormBlock } from "@/components/projects/form/form-ui";
import { TeamFeedbackBlock } from "@/components/normas/form/team-feedback-block";
import { IdentificationBlock } from "@/components/normas/form/identification-block";
import { ObjectBlock } from "@/components/normas/form/object-block";
import { OldCodeBlock } from "@/components/normas/form/old-code-block";
import { ArticleTextBlock } from "@/components/normas/form/article-text-block";
import { AnalysisBlock } from "@/components/normas/form/analysis-block";
import { materiaLabels, normStatusLabels, type NormDetail, type ProjectAnchorView, type ProjectDiagnosisView } from "@/lib/projects/shared";

const MIN_SUMMARY = 40;

/**
 * Editor de norma de la Fabrica, en dos pasos de IA:
 * 1. Formalizar: el objeto en crudo se convierte en articulado formal.
 * 2. Comparar: la norma formalizada se cruza contra el CPU 2014; la IA detecta
 *    y ancla los articulos tocados, y el analista revisa cada marca.
 * La norma se persiste como borrador apenas hay titulo + objeto valido.
 */
export function NormEditor({
  reform,
  norm,
  canEdit,
  canDelete = false
}: {
  reform: { id: string; code: string; title: string };
  norm: NormDetail | null;
  canEdit: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Precarga desde el panel de temas mas pedidos:
   *   /normas/{reformId}/nueva?materia=PLANEAMIENTO&tema=Usos del suelo
   * Solo aplica a una norma nueva; sobre una existente los params se ignoran para
   * no pisar lo que el equipo ya escribio. El texto es un punto de partida editable.
   */
  const seeded = useMemo(() => {
    if (norm) return { areas: null, summary: null };
    const rawArea = searchParams.get("materia");
    const topic = searchParams.get("tema");
    const area = rawArea && rawArea in materiaLabels ? (rawArea as MunicipalArea) : null;
    return {
      areas: area ? [area] : null,
      summary: topic
        ? `Tema surgido de los aportes ciudadanos: "${topic}". Redactar la norma que regule este aspecto del CPU.`
        : null
    };
  }, [norm, searchParams]);

  const [normId, setNormId] = useState<string | null>(norm?.id ?? null);
  const [code, setCode] = useState<string | null>(norm?.code ?? null);

  const [title, setTitle] = useState(norm?.title ?? "");
  const [articleNumber, setArticleNumber] = useState(norm?.articleNumber ?? "");
  const [status, setStatus] = useState<ProjectStatus>(norm?.status ?? "DRAFT");
  const [areas, setAreas] = useState<MunicipalArea[]>(norm?.areas ?? seeded.areas ?? []);
  const [summary, setSummary] = useState(norm?.summary ?? seeded.summary ?? "");
  const [articleText, setArticleText] = useState(norm?.articleText ?? "");
  const [officialNotes, setOfficialNotes] = useState(norm?.officialNotes ?? "");

  const [anchors, setAnchors] = useState<ProjectAnchorView[]>(norm?.anchors ?? []);
  const [analyses, setAnalyses] = useState<ProjectDiagnosisView[]>(norm?.diagnoses ?? []);
  const [activeAnalysisIndex, setActiveAnalysisIndex] = useState(0);

  // Paso 1: la sugerencia formalizada vive aca (no en el diagnostico).
  const [proposedText, setProposedText] = useState<string | null>(null);
  const [formalizing, setFormalizing] = useState(false);
  const [formalizeError, setFormalizeError] = useState("");

  // Paso 2: comparacion contra el codigo viejo.
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const creatingRef = useRef(false);

  const readOnly = !canEdit;
  const canDraft = title.trim().length > 0 && summary.trim().length >= MIN_SUMMARY;
  const canCompare = canDraft && articleText.trim().length > 0;

  const corePayload = useCallback(
    () => ({
      title: title.trim(),
      summary: summary.trim(),
      status,
      areas,
      articleNumber: articleNumber.trim() || null,
      articleText: articleText.trim() || null,
      officialNotes: officialNotes.trim() || null
    }),
    [title, summary, status, areas, articleNumber, articleText, officialNotes]
  );

  // Crea el borrador (una sola vez) cuando hay titulo + objeto valido.
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (normId) return normId;
    if (creatingRef.current) return null;
    if (!canDraft) return null;
    creatingRef.current = true;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corePayload(), reformId: reform.id })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail || payload?.error || "No se pudo guardar el borrador.");
        return null;
      }
      setNormId(payload.norm.id);
      setCode(payload.norm.code);
      return payload.norm.id as string;
    } finally {
      creatingRef.current = false;
    }
  }, [normId, canDraft, corePayload, reform.id]);

  // Auto-persistir como borrador apenas hay titulo + objeto valido.
  useEffect(() => {
    if (!readOnly && !normId && canDraft) void ensureDraft();
  }, [readOnly, normId, canDraft, ensureDraft]);

  // Autosave (debounce) una vez que existe el borrador.
  useEffect(() => {
    if (readOnly || !normId) return;
    const timer = setTimeout(() => {
      fetch(`/api/projects/${normId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corePayload())
      }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [readOnly, normId, corePayload]);

  /**
   * Los pasos de IA leen la norma desde la base: antes de invocarlos hay que
   * persistir lo que el analista tiene en pantalla (el autosave tiene debounce
   * y puede estar atrasado).
   */
  const flushSave = useCallback(
    async (id: string) => {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corePayload())
      }).catch(() => undefined);
    },
    [corePayload]
  );

  function toggleArea(area: MunicipalArea) {
    setAreas((current) => (current.includes(area) ? current.filter((entry) => entry !== area) : [...current, area]));
  }

  /** Paso 1: formalizar el objeto como articulado. */
  const runFormalize = useCallback(async () => {
    setFormalizeError("");
    const id = normId ?? (await ensureDraft());
    if (!id) {
      setFormalizeError("Cargá el título y un objeto de al menos 40 caracteres para formalizar.");
      return;
    }
    setFormalizing(true);
    try {
      await flushSave(id);
      const response = await fetch(`/api/projects/${id}/formalize`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo formalizar la norma.");
      setProposedText(payload.proposedText as string);
    } catch (formalizeFailure) {
      setFormalizeError(formalizeFailure instanceof Error ? formalizeFailure.message : "No se pudo formalizar la norma.");
    } finally {
      setFormalizing(false);
    }
  }, [normId, ensureDraft, flushSave]);

  /** Paso 2: comparar la norma formalizada contra el CPU 2014. */
  const runCompare = useCallback(async () => {
    setComparisonError("");
    const id = normId ?? (await ensureDraft());
    if (!id) {
      setComparisonError("Cargá el título y un objeto de al menos 40 caracteres.");
      return;
    }
    if (!articleText.trim()) {
      setComparisonError("Formalizá la norma antes de compararla con el código viejo.");
      return;
    }
    setComparing(true);
    try {
      await flushSave(id);
      const response = await fetch(`/api/projects/${id}/diagnose`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo comparar la norma.");
      setAnalyses((current) => [payload.diagnosis as ProjectDiagnosisView, ...current]);
      setActiveAnalysisIndex(0);
      setAnchors(payload.anchors as ProjectAnchorView[]);
    } catch (comparisonFailure) {
      setComparisonError(comparisonFailure instanceof Error ? comparisonFailure.message : "No se pudo comparar la norma.");
    } finally {
      setComparing(false);
    }
  }, [normId, ensureDraft, articleText, flushSave]);

  function replaceAnalysis(updated: ProjectDiagnosisView) {
    setAnalyses((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  }

  function useProposedText() {
    if (proposedText) setArticleText(proposedText);
  }

  async function removeNorm() {
    if (!normId) return;
    if (!window.confirm("¿Eliminar esta norma de forma permanente? Se pierden sus anclajes y su historial de análisis.")) return;
    setError("");
    try {
      const response = await fetch(`/api/projects/${normId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo eliminar la norma.");
      }
      router.push(`/normas/${reform.id}`);
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No se pudo eliminar la norma.");
    }
  }

  async function finalize(mode: "draft" | "final") {
    setError("");
    setSaving(true);
    try {
      const id = normId ?? (await ensureDraft());
      if (!id) {
        setError("Cargá el título y un objeto de al menos 40 caracteres.");
        return;
      }
      const nextStatus: ProjectStatus = mode === "draft" ? "DRAFT" : status === "DRAFT" ? "IN_REVIEW" : status;
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corePayload(), status: nextStatus })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo guardar la norma.");
      }
      setStatus(nextStatus);
      if (mode === "final") {
        router.push(`/normas/${reform.id}`);
      }
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : "No se pudo guardar la norma.");
    } finally {
      setSaving(false);
    }
  }

  const summaryHint = useMemo(() => {
    const length = summary.trim().length;
    if (length === 0) return "";
    if (length < MIN_SUMMARY) return `${length}/${MIN_SUMMARY} caracteres para habilitar la IA`;
    return "Listo para formalizar";
  }, [summary]);

  const materiaPrincipal = areas.length ? materiaLabels[areas[0]] : null;

  return (
    <div className="space-y-4 pb-28">
      <div>
        <Link href={`/normas/${reform.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          {reform.code} · {reform.title}
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">
          {norm || normId ? (articleNumber ? `Artículo ${articleNumber} — ` : "") + (title.trim() || "Norma sin título") : "Nueva norma"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          {materiaPrincipal ? `${materiaPrincipal} · ` : ""}
          {normStatusLabels[status]}
          {code ? <span className="ml-2 rounded bg-white/[0.06] px-2 py-0.5 font-mono text-xs font-semibold text-sky-200">{code}</span> : null}
          {norm?.authorName ? <span className="ml-2 text-slate-500">· Creada por {norm.authorName}</span> : null}
        </p>
        {!normId ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Escribí el objeto en crudo y formalizalo con IA; después compará la norma contra el CPU 2014 para que la IA detecte y marque los artículos que toca.
          </p>
        ) : null}
      </div>

      <FormBlock index={1} title="Identificación" description="Título, número tentativo dentro del código nuevo, materia y estado.">
        <IdentificationBlock
          title={title}
          articleNumber={articleNumber}
          status={status}
          areas={areas}
          disabled={readOnly}
          onTitleChange={setTitle}
          onArticleNumberChange={setArticleNumber}
          onStatusChange={setStatus}
          onToggleArea={toggleArea}
        />
      </FormBlock>

      <FormBlock
        index={2}
        title="Objeto de la norma"
        description="Qué se quiere regular y por qué, escrito en crudo. Paso 1: la IA lo convierte en articulado formal."
        action={summaryHint ? <span className={`text-xs font-bold ${summary.trim().length >= MIN_SUMMARY ? "text-emerald-300" : "text-slate-400"}`}>{summaryHint}</span> : null}
      >
        <ObjectBlock
          value={summary}
          disabled={readOnly}
          canFormalize={canDraft}
          formalizing={formalizing}
          onChange={setSummary}
          onFormalize={runFormalize}
        />
        {formalizeError ? <p className="mt-2 text-xs font-bold text-amber-200">{formalizeError}</p> : null}
      </FormBlock>

      <FormBlock
        index={3}
        title="Texto del articulado"
        description="La norma en sí. Revisá y corregí el texto formalizado antes de compararlo con el código viejo."
      >
        <ArticleTextBlock
          articleText={articleText}
          proposedText={proposedText}
          disabled={readOnly}
          onChange={setArticleText}
          onUseProposed={useProposedText}
        />
      </FormBlock>

      <FormBlock
        index={4}
        title="Análisis de impacto normativo"
        description="Paso 2: la comparación detecta los artículos afectados y produce recomendaciones y conflictos con lo vigente."
      >
        <AnalysisBlock
          normId={normId}
          analyses={analyses}
          activeIndex={activeAnalysisIndex}
          canGenerate={canCompare}
          generating={comparing}
          canEdit={canEdit}
          error={comparisonError}
          onSelectVersion={setActiveAnalysisIndex}
          onGenerate={runCompare}
          onUpdated={replaceAnalysis}
        />
      </FormBlock>

      <FormBlock
        index={5}
        title="Código viejo (CPU 2014)"
        description="Los artículos que la norma toca. La IA los detecta y marca en la comparación; el equipo revisa la relación, quita o agrega a mano."
        collapsible
        defaultOpen={anchors.length > 0}
      >
        <OldCodeBlock normId={normId} ensureDraft={ensureDraft} anchors={anchors} disabled={readOnly} onChange={setAnchors} />
      </FormBlock>

      <FormBlock
        index={6}
        title="Observaciones del equipo"
        description="Lo que el análisis IA omitió o lo que quieras dejar asentado."
        collapsible
        defaultOpen={Boolean(officialNotes.trim())}
      >
        <textarea
          value={officialNotes}
          disabled={readOnly}
          onChange={(event) => setOfficialNotes(event.target.value)}
          rows={4}
          placeholder="Agregá lo que el análisis IA omitió o lo que quieras dejar asentado."
          className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
        />
      </FormBlock>

      {/* Solo sobre una norma persistida: sobre un borrador sin id no hay nada que opinar. */}
      {normId ? (
        <FormBlock
          index={7}
          title="Opiniones del equipo"
          description="Devoluciones internas y apoyo a la norma. No lo ven los vecinos."
          collapsible
          defaultOpen={Boolean(norm?.opinionCount)}
        >
          <TeamFeedbackBlock
            normId={normId}
            canEdit={canEdit}
            initialSupport={{
              supportCount: norm?.supportCount ?? 0,
              objectionCount: norm?.objectionCount ?? 0,
              net: norm?.supportNet ?? 0,
              myValue: norm?.myValue ?? null
            }}
          />
        </FormBlock>
      ) : null}

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07111d]/95 px-4 py-3 backdrop-blur lg:pl-[260px]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-slate-400">
              {error ? (
                <span className="font-bold text-amber-200">{error}</span>
              ) : code ? (
                <span>Borrador guardado · {code}</span>
              ) : (
                <span>El borrador se guarda solo al completar título y objeto.</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canDelete && normId ? (
                <button
                  type="button"
                  onClick={removeNorm}
                  className="urban-button inline-flex items-center gap-2 rounded-md border border-rose-300/25 bg-rose-300/10 px-4 py-2.5 text-sm font-bold text-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => normId && window.open(`/api/projects/${normId}/export`, "_blank")}
                disabled={!normId || !articleText.trim()}
                className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                Exportar norma
              </button>
              <button
                type="button"
                onClick={() => finalize("draft")}
                disabled={saving || !canDraft}
                className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={() => finalize("final")}
                disabled={saving || !canDraft}
                className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Guardar norma
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
