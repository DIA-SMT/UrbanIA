"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import type { HearingDocumentView } from "@/lib/hearings/shared";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Documentos adjuntos de una audiencia: lista con descarga y, para el equipo,
 * subida (a Supabase Storage vía la API) y borrado. Refresca el detalle al
 * completar cada acción.
 */
export function HearingDocuments({
  hearingId,
  documents,
  canEdit
}: {
  hearingId: string;
  documents: HearingDocumentView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/hearings/${hearingId}/documents`, { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo subir el documento.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el documento.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(documentId: string, fileName: string) {
    if (!window.confirm(`¿Eliminar "${fileName}"? Se borra el archivo de forma permanente.`)) return;
    setError("");
    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/hearings/${hearingId}/documents/${documentId}`, { method: "DELETE" });
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

  if (!canEdit && documents.length === 0) return null;

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black text-white">
          <Paperclip className="h-4 w-4 text-[#1f89f6]" />
          Documentos adjuntos
        </p>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.doc,.docx,.odt,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="urban-button inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-slate-200 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? "Subiendo…" : "Subir documento"}
            </button>
          </>
        ) : null}
      </div>

      {error ? <p className="mb-2 text-xs font-bold text-amber-200">{error}</p> : null}

      {documents.length ? (
        <div className="grid gap-2">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-slate-200 transition hover:text-sky-200"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#1f89f6]" />
                <span className="truncate">{document.fileName}</span>
                {document.sizeBytes !== null ? <span className="shrink-0 text-[11px] font-normal text-slate-500">· {formatSize(document.sizeBytes)}</span> : null}
              </a>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-sky-200"
                  title="Descargar"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => remove(document.id, document.fileName)}
                    disabled={deletingId === document.id}
                    className="rounded p-1.5 text-slate-400 transition hover:bg-rose-300/10 hover:text-rose-200 disabled:opacity-60"
                    title="Eliminar"
                  >
                    {deletingId === document.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Todavía no hay documentos adjuntos. Subí propuestas, dictámenes o anexos en PDF, Word, imágenes o planillas.</p>
      )}
    </section>
  );
}
