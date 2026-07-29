"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import type { ReformDocumentView } from "@/lib/projects/shared";

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
  canEdit
}: {
  reformId: string;
  documents: ReformDocumentView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
