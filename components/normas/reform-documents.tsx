"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ExternalLink, FileText, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { asignarAudienciaADocumento } from "@/lib/normas/actions";
import type { ReformDocumentView } from "@/lib/projects/shared";

export type MeetingOption = { id: string; title: string; occurredAt: string | null };

const KIND_LABELS: Record<string, string> = {
  PROPUESTA_NORMATIVA: "Propuesta normativa",
  DIAGNOSTICO_TECNICO: "Diagnóstico técnico",
  PRESENTACION_INSTITUCIONAL: "Presentación institucional",
  PONENCIA_ACADEMICA: "Ponencia académica",
  OTRO: "Otro"
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Antecedentes de la reforma: los PDF aportados por agrupaciones, colegios,
 * universidades y ONGs. Aca viven tambien —sobre todo— los que NO produjeron
 * ninguna norma: encuadres institucionales y ponencias metodologicas, que son
 * la mayoria del material de la 1ª Audiencia Publica.
 */
export function ReformDocuments({
  reformId,
  documents,
  meetings = [],
  canEdit
}: {
  reformId: string;
  documents: ReformDocumentView[];
  /** Audiencias a las que se puede asignar cada documento. */
  meetings?: MeetingOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sinAsignar = documents.filter((document) => !document.meetingId).length;

  function asignar(document: ReformDocumentView, meetingId: string) {
    setError("");
    setSavingId(document.id);
    startTransition(async () => {
      const result = await asignarAudienciaADocumento(document.id, meetingId || null);
      if (!result.ok) setError(result.error);
      else router.refresh();
      setSavingId(null);
    });
  }

  async function remove(document: ReformDocumentView) {
    if (!window.confirm(`¿Eliminar "${document.name}" de los antecedentes? Se borra el archivo de forma permanente.`)) return;
    setError("");
    setDeletingId(document.id);
    try {
      const response = await fetch(`/api/reforms/${reformId}?docId=${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo eliminar el documento.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!documents.length) return null;

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black text-white">
          <FileText className="h-4 w-4 text-[#1f89f6]" />
          Antecedentes
        </p>
        <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-black text-sky-200">
          {documents.length} {documents.length === 1 ? "documento" : "documentos"}
        </span>
      </div>

      <p className="mb-3 text-xs leading-5 text-slate-500">
        Documentos aportados a la reforma. Los que no produjeron normas se conservan igual: son parte del expediente de la audiencia.
      </p>

      {/* Estos PDF se cargaron cuando el documento colgaba solo de la reforma,
          asi que no tienen audiencia. No se puede resolver automaticamente: los
          nombres dan pistas pero adivinar mal ensucia un expediente publico. */}
      {canEdit && sinAsignar > 0 && meetings.length > 0 ? (
        <div className="mb-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-black text-amber-100">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {sinAsignar} {sinAsignar === 1 ? "documento sin audiencia" : "documentos sin audiencia"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-amber-100/80">
            Elegí en qué audiencia se presentó cada uno. Es lo que lo vuelve parte de ese expediente y permite ver el cruce con el Código
            desde la audiencia.
          </p>
        </div>
      ) : null}

      {error ? <p className="mb-2 text-xs font-bold text-amber-200">{error}</p> : null}

      <div className="grid gap-2">
        {documents.map((document) => (
          // El min-w-0 no es decorativo: sin el, un nombre de archivo largo
          // desborda la pagina entera. `truncate` incluye white-space: nowrap,
          // asi que recorta lo que se VE pero el texto sigue MIDIENDO todo su
          // ancho; y una columna de grid `auto` nunca baja del min-content de su
          // item, que por defecto tiene min-width: auto. Resultado: un PDF
          // llamado "2da AUDIENCIA PUBLICA · CPU SMT EL NUEVO..." estiraba la
          // columna a 1641 px dentro de un viewport de 1265 y se llevaba puestas
          // a las quince tarjetas. El min-w-0 del div de adentro no alcanza:
          // arregla el encogido dentro del flex, no el tamano de la pista.
          <div key={document.id} className="min-w-0 rounded-md border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{document.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-400">
                  {document.documentKind ? <span>{KIND_LABELS[document.documentKind] ?? document.documentKind}</span> : null}
                  {document.pageCount ? <span>{document.pageCount} págs.</span> : null}
                  {document.sizeBytes ? <span>{formatSize(document.sizeBytes)}</span> : null}
                  <span className={document.normCount ? "text-sky-200" : "text-slate-500"}>
                    {document.normCount === 0
                      ? "Sin normas · antecedente"
                      : `${document.normCount} ${document.normCount === 1 ? "norma" : "normas"}`}
                  </span>
                </p>
                {document.summary ? (
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{document.summary}</p>
                ) : null}

                {/* La audiencia donde se presento. Con permiso de edicion es un
                    select para poder corregirla; sin permiso, solo se lee. */}
                {canEdit && meetings.length > 0 ? (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <CalendarClock className="h-3 w-3" />
                      Se presentó en
                    </span>
                    <select
                      value={document.meetingId ?? ""}
                      disabled={savingId === document.id}
                      onChange={(event) => asignar(document, event.target.value)}
                      className="min-w-0 max-w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-slate-200 outline-none focus:border-sky-300/40 disabled:opacity-60"
                    >
                      <option value="">— Sin asignar —</option>
                      {meetings.map((meeting) => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title}
                          {meeting.occurredAt ? ` · ${new Date(meeting.occurredAt).toLocaleDateString("es-AR")}` : ""}
                        </option>
                      ))}
                    </select>
                    {savingId === document.id ? <Loader2 className="h-3 w-3 animate-spin text-sky-200" /> : null}
                    {savingId !== document.id && document.meetingId ? <Check className="h-3 w-3 text-emerald-300" /> : null}
                  </label>
                ) : document.meetingTitle ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                    <CalendarClock className="h-3 w-3" />
                    Se presentó en {document.meetingTitle}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-sky-200"
                    title="Abrir el PDF"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => remove(document)}
                    disabled={deletingId === document.id}
                    className="rounded p-1.5 text-slate-400 transition hover:bg-rose-300/10 hover:text-rose-200 disabled:opacity-60"
                    title="Eliminar de los antecedentes"
                  >
                    {deletingId === document.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
