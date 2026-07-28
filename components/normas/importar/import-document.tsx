"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MunicipalArea } from "@prisma/client";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { materiaLabels } from "@/lib/projects/shared";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

const KIND_OPTIONS = [
  { value: "PROPUESTA_NORMATIVA", label: "Propuesta normativa" },
  { value: "DIAGNOSTICO_TECNICO", label: "Diagnóstico técnico" },
  { value: "PRESENTACION_INSTITUCIONAL", label: "Presentación institucional" },
  { value: "PONENCIA_ACADEMICA", label: "Ponencia académica" },
  { value: "OTRO", label: "Otro" }
];

type Confidence = "alta" | "media" | "baja";

type Proposal = {
  title: string;
  summary: string;
  areas: MunicipalArea[];
  sourcePages: number[];
  evidenceQuote: string;
  confidence: Confidence;
};

type Analysis = {
  documentKind: string;
  documentSummary: string;
  organization: string | null;
  authors: string[];
  pageCount: number;
  proposals: Proposal[];
  warnings: string[];
  model?: string | null;
};

/** Propuesta con el estado de revisión de la persona. */
type ReviewItem = Proposal & { accepted: boolean };

type Phase = "idle" | "subiendo" | "extrayendo" | "analizando" | "revision" | "creando" | "listo";

type CreatedNorm = { id: string; code: string; title: string };

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  alta: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  media: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  baja: "border-amber-300/30 bg-amber-300/10 text-amber-100"
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Hash del archivo, para avisar si ese mismo PDF ya se había subido. */
async function sha256Hex(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** PUT al bucket con barra de progreso. fetch no reporta progreso de subida. */
function uploadWithProgress(signedUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`El bucket rechazó la subida (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida."));
    xhr.send(file);
  });
}

/**
 * Importa un PDF aportado a la reforma: lo sube, la IA propone el llenado y la
 * persona revisa antes de que se cree nada.
 *
 * El archivo va DIRECTO al bucket con una signed URL: no puede pasar por una
 * ruta de Next porque Vercel corta el body en ~4,5 MB y acá el límite es 30 MB.
 */
export function ImportDocument({
  reformId,
  reformCode,
  reformTitle
}: {
  reformId: string;
  reformCode: string;
  reformTitle: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [storagePath, setStoragePath] = useState("");
  const [sha256, setSha256] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [documentKind, setDocumentKind] = useState("");
  const [documentSummary, setDocumentSummary] = useState("");
  const [organization, setOrganization] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);

  const [createdNorms, setCreatedNorms] = useState<CreatedNorm[]>([]);
  const [creatingLabel, setCreatingLabel] = useState("");
  const [chainState, setChainState] = useState<Record<string, string>>({});

  const accepted = items.filter((item) => item.accepted);

  async function start(picked: File) {
    setError("");
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      setError("El importador solo lee PDF.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError(`"${picked.name}" pesa ${formatSize(picked.size)} y el límite es 30 MB.`);
      return;
    }

    setFile(picked);
    setProgress(0);
    setPhase("subiendo");

    try {
      const hash = await sha256Hex(picked);
      setSha256(hash);

      // Los tres pasos van a la MISMA ruta con distinto `action`: el plan Hobby
      // de Vercel admite 12 funciones serverless y cada route.ts cuenta una.
      const urlResponse = await fetch(`/api/reforms/${reformId}?action=documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload-url",
          fileName: picked.name,
          sizeBytes: picked.size,
          mimeType: picked.type || "application/pdf"
        })
      });
      const urlPayload = await urlResponse.json().catch(() => null);
      if (!urlResponse.ok) {
        throw new Error(urlPayload?.detail || urlPayload?.error || "No se pudo preparar la subida.");
      }

      await uploadWithProgress(urlPayload.signedUrl, picked, setProgress);
      setStoragePath(urlPayload.storagePath);

      setPhase("extrayendo");
      // La extracción y el análisis ocurren en la misma llamada del servidor;
      // se muestran como dos pasos porque es lo que la persona percibe.
      setTimeout(() => setPhase((current) => (current === "extrayendo" ? "analizando" : current)), 1200);

      const analyzeResponse = await fetch(`/api/reforms/${reformId}?action=documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", storagePath: urlPayload.storagePath })
      });
      const analyzePayload = await analyzeResponse.json().catch(() => null);

      if (!analyzeResponse.ok) {
        // 422 = PDF sin texto legible. El archivo YA está subido, así que se
        // puede guardar igual como antecedente: no se pierde el trabajo.
        if (analyzeResponse.status === 422) {
          setAnalysis({
            documentKind: "OTRO",
            documentSummary: "",
            organization: null,
            authors: [],
            pageCount: 0,
            proposals: [],
            warnings: [analyzePayload?.detail || "El PDF no tiene texto legible."]
          });
          setDocumentKind("OTRO");
          setDocumentSummary("");
          setOrganization("");
          setItems([]);
          setPhase("revision");
          return;
        }
        throw new Error(analyzePayload?.detail || analyzePayload?.error || "No se pudo analizar el documento.");
      }

      const result = analyzePayload as Analysis;
      setAnalysis(result);
      setDocumentKind(result.documentKind);
      setDocumentSummary(result.documentSummary);
      setOrganization(result.organization ?? "");
      // Las de confianza baja arrancan DESCARTADAS: que aceptar sea un acto
      // deliberado cuando la evidencia es floja.
      setItems(result.proposals.map((proposal) => ({ ...proposal, accepted: proposal.confidence !== "baja" })));
      setPhase("revision");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el documento.");
      setPhase("idle");
    }
  }

  function patchItem(index: number, patch: Partial<ReviewItem>) {
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }

  function toggleArea(index: number, area: MunicipalArea) {
    setItems((current) =>
      current.map((item, position) => {
        if (position !== index) return item;
        const has = item.areas.includes(area);
        return { ...item, areas: has ? item.areas.filter((a) => a !== area) : [...item.areas, area] };
      })
    );
  }

  async function confirm() {
    if (!file) return;
    setError("");
    setPhase("creando");
    setCreatingLabel(accepted.length ? `Creando 1 de ${accepted.length}…` : "Guardando el antecedente…");

    try {
      const response = await fetch(`/api/reforms/${reformId}?action=documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          storagePath,
          fileName: file.name,
          sizeBytes: file.size,
          pageCount: analysis?.pageCount ?? null,
          documentKind: documentKind || null,
          documentSummary: documentSummary || null,
          organization: organization || null,
          sha256,
          model: analysis?.model ?? null,
          acceptedProposals: accepted.map((item) => ({
            title: item.title,
            summary: item.summary,
            areas: item.areas,
            sourcePages: item.sourcePages,
            evidenceQuote: item.evidenceQuote
          }))
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "No se pudo guardar el documento.");
      }

      setCreatedNorms(payload.norms ?? []);
      setPhase("listo");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el documento.");
      setPhase("revision");
    }
  }

  /**
   * Encadena Formalizar → guardar el articulado → Comparar.
   *
   * El PATCH del medio no es opcional: formalizeNorm devuelve el texto pero no
   * lo persiste, y /diagnose responde 422 si la norma no tiene articleText.
   */
  async function formalizeAndCompare(norm: CreatedNorm) {
    setChainState((current) => ({ ...current, [norm.id]: "Formalizando…" }));
    try {
      const formalize = await fetch(`/api/projects/${norm.id}?action=formalize`, { method: "POST" });
      const formalizePayload = await formalize.json().catch(() => null);
      if (!formalize.ok) {
        throw new Error(formalizePayload?.detail || formalizePayload?.error || "No se pudo formalizar.");
      }

      setChainState((current) => ({ ...current, [norm.id]: "Guardando el articulado…" }));
      const patch = await fetch(`/api/projects/${norm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleText: formalizePayload.proposedText })
      });
      if (!patch.ok) throw new Error("No se pudo guardar el articulado propuesto.");

      setChainState((current) => ({ ...current, [norm.id]: "Comparando con el código viejo…" }));
      const diagnose = await fetch(`/api/projects/${norm.id}?action=diagnose`, { method: "POST" });
      const diagnosePayload = await diagnose.json().catch(() => null);
      if (!diagnose.ok) {
        throw new Error(diagnosePayload?.detail || diagnosePayload?.error || "No se pudo comparar.");
      }

      setChainState((current) => ({ ...current, [norm.id]: "Listo: articulado y diagnóstico generados" }));
    } catch (err) {
      setChainState((current) => ({
        ...current,
        [norm.id]: err instanceof Error ? err.message : "Falló el encadenado."
      }));
    }
  }

  /* ------------------------------- Render -------------------------------- */

  return (
    <div className="space-y-4">
      <Link
        href={`/normas/${reformId}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {reformCode} · {reformTitle}
      </Link>

      <div>
        <h1 className="text-3xl font-black leading-tight text-white">Importar un documento</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
          Subí el PDF que aportó una agrupación, colegio, universidad u ONG. Migue lo lee y propone qué normas contiene; vos revisás y decidís antes de que se cree nada.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        </div>
      ) : null}

      {phase === "idle" ? (
        <section className="urban-card rounded-lg p-6 text-center lg:p-10">
          <FileUp className="mx-auto h-8 w-8 text-[#1f89f6]" />
          <h2 className="mt-4 text-xl font-black text-white">Elegí el PDF</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Solo PDF, hasta 30 MB. El archivo se guarda como evidencia del expediente.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) void start(picked);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="urban-button mt-6 inline-flex items-center gap-2 rounded-md bg-civic-blue px-5 py-3 text-sm font-black text-white"
          >
            <Upload className="h-4 w-4" />
            Seleccionar PDF
          </button>
        </section>
      ) : null}

      {phase === "subiendo" || phase === "extrayendo" || phase === "analizando" || phase === "creando" ? (
        <section className="urban-card rounded-lg p-6 text-center lg:p-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1f89f6]" />
          <h2 className="mt-4 text-xl font-black text-white">
            {phase === "subiendo" ? `Subiendo el PDF… ${progress}%` : null}
            {phase === "extrayendo" ? "Extrayendo el texto…" : null}
            {phase === "analizando" ? "Migue está leyendo el documento…" : null}
            {phase === "creando" ? creatingLabel : null}
          </h2>
          {phase === "subiendo" ? (
            <div className="mx-auto mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-civic-blue transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {phase === "analizando" ? (
            <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-slate-500">
              Puede tardar hasta un minuto en documentos largos. No cierres esta pantalla.
            </p>
          ) : null}
        </section>
      ) : null}

      {phase === "revision" && analysis ? (
        <>
          {analysis.warnings.length ? (
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-black text-amber-100">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {analysis.warnings.length === 1 ? "Una advertencia" : `${analysis.warnings.length} advertencias`}
              </p>
              <ul className="mt-2 grid gap-1.5">
                {analysis.warnings.map((warning, index) => (
                  <li key={index} className="text-xs leading-5 text-amber-100/85">· {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="urban-card rounded-lg p-4 lg:p-5">
            <p className="text-sm font-black text-white">Qué es este documento</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {file?.name}
              {analysis.pageCount ? ` · ${analysis.pageCount} páginas` : ""}
              {file ? ` · ${formatSize(file.size)}` : ""}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <Label>Tipo de documento</Label>
                <select
                  value={documentKind}
                  onChange={(event) => setDocumentKind(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <Label>Organización que lo aporta</Label>
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Colegio de Arquitectos, CERCPU…"
                  className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
                />
              </label>
            </div>

            <label className="mt-3 grid gap-1.5">
              <Label>Resumen</Label>
              <textarea
                value={documentSummary}
                onChange={(event) => setDocumentSummary(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-sky-300/50"
              />
            </label>
          </section>

          {items.length ? (
            <section className="urban-card rounded-lg p-4 lg:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-sm font-black text-white">
                  <Sparkles className="h-4 w-4 text-[#1f89f6]" />
                  Propuestas detectadas
                </p>
                <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-black text-sky-200">
                  {accepted.length} de {items.length} aceptadas
                </span>
              </div>

              <div className="grid gap-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 transition ${
                      item.accepted ? "border-sky-300/25 bg-white/[0.04]" : "border-white/8 bg-white/[0.01] opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-200">
                        <input
                          type="checkbox"
                          checked={item.accepted}
                          onChange={(event) => patchItem(index, { accepted: event.target.checked })}
                          className="h-4 w-4 accent-[#1f89f6]"
                        />
                        {item.accepted ? "Se va a crear" : "Descartada"}
                      </label>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${CONFIDENCE_STYLE[item.confidence]}`}>
                          confianza {item.confidence}
                        </span>
                        {item.sourcePages.length ? (
                          <span className="text-[10px] font-bold text-slate-500">
                            pág. {item.sourcePages.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <label className="grid gap-1.5">
                        <Label>Título</Label>
                        <input
                          value={item.title}
                          onChange={(event) => patchItem(index, { title: event.target.value })}
                          className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-sky-300/50"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label>Qué propone</Label>
                        <textarea
                          value={item.summary}
                          onChange={(event) => patchItem(index, { summary: event.target.value })}
                          rows={3}
                          className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-sky-300/50"
                        />
                      </label>

                      <div className="grid gap-1.5">
                        <Label>Materias</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.keys(materiaLabels) as MunicipalArea[]).map((area) => (
                            <button
                              key={area}
                              type="button"
                              onClick={() => toggleArea(index, area)}
                              className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${
                                item.areas.includes(area)
                                  ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
                                  : "border-white/10 bg-white/[0.03] text-slate-400"
                              }`}
                            >
                              {materiaLabels[area]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Cita textual del PDF</Label>
                        <p className="mt-1.5 border-l-2 border-[#f6d500] pl-2 text-xs italic leading-5 text-slate-300">
                          “{item.evidenceQuote}”
                        </p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          Verificada: aparece textualmente en el documento.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="urban-card rounded-lg p-6 text-center lg:p-8">
              <h2 className="text-lg font-black text-white">No se encontraron propuestas normativas</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                La IA no encontró propuestas normativas concretas en este documento. Es lo esperable en presentaciones institucionales, diagnósticos y ponencias sobre el proceso de reforma. Podés guardarlo igual como antecedente.
              </p>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={confirm}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-5 py-3 text-sm font-black text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              {accepted.length
                ? `Guardar y crear ${accepted.length} ${accepted.length === 1 ? "norma" : "normas"}`
                : "Guardar sólo como antecedente"}
            </button>
            <Link
              href={`/normas/${reformId}`}
              className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200"
            >
              Cancelar
            </Link>
          </div>
        </>
      ) : null}

      {phase === "listo" ? (
        <section className="urban-card rounded-lg p-6 lg:p-8">
          <CheckCircle2 className="h-8 w-8 text-emerald-300" />
          <h2 className="mt-4 text-xl font-black text-white">
            {createdNorms.length
              ? `Documento guardado y ${createdNorms.length} ${createdNorms.length === 1 ? "norma creada" : "normas creadas"}`
              : "Documento guardado como antecedente"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {createdNorms.length
              ? "Las normas quedaron en borrador, con el PDF como evidencia. Todavía no tienen articulado: eso se genera en el paso Formalizar y hay que validarlo."
              : "El PDF queda en los antecedentes de la reforma. No se creó ninguna norma."}
          </p>

          {createdNorms.length ? (
            <div className="mt-5 grid gap-2">
              {createdNorms.map((norm) => (
                <div key={norm.id} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-slate-400">{norm.code}</span>
                      <p className="truncate text-sm font-black text-white">{norm.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/normas/${reformId}/${norm.id}`}
                        className="urban-button inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200"
                      >
                        Abrir
                      </Link>
                      <button
                        type="button"
                        onClick={() => formalizeAndCompare(norm)}
                        disabled={Boolean(chainState[norm.id]) && !chainState[norm.id]?.startsWith("Listo") && !chainState[norm.id]?.startsWith("Falló")}
                        className="urban-button inline-flex items-center gap-1.5 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black text-sky-100 disabled:opacity-60"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Formalizar y comparar
                      </button>
                    </div>
                  </div>
                  {chainState[norm.id] ? (
                    <p className="mt-2 text-[11px] font-bold text-slate-400">{chainState[norm.id]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/normas/${reformId}`}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white"
            >
              Volver al código
            </Link>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setFile(null);
                setAnalysis(null);
                setItems([]);
                setCreatedNorms([]);
                setChainState({});
                setStoragePath("");
                setError("");
              }}
              className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200"
            >
              <FileUp className="h-4 w-4" />
              Importar otro PDF
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{children}</span>;
}
