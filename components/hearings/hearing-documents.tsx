"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { uploadToBucket } from "@/components/shared/upload-to-bucket";
import type { HearingDocumentView } from "@/lib/hearings/shared";

// Debe coincidir con MAX_FILE_BYTES del handler de documentos Y con el limite
// del bucket "audiencias" en Supabase (hay tres lugares y el bucket es el que
// manda: si el suyo queda mas bajo, el PUT del navegador falla despues de haber
// subido, con un error del storage que no dice nada util).
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
  canUpload,
  canDelete
}: {
  hearingId: string;
  documents: HearingDocumentView[];
  /** documents.upload */
  canUpload: boolean;
  /** documents.delete: el tacho es un permiso aparte del de subir. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  /**
   * Subida directa al bucket en tres pasos (firmar → PUT → registrar): el
   * archivo nunca pasa por una función de Vercel, cuyo body se corta en
   * ~4,5 MB; así los 50 MB prometidos son reales.
   */
  async function upload(file: File) {
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError(`"${file.name}" pesa ${formatSize(file.size)} y el límite es 50 MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const signResponse = await fetch(`/api/hearings/${hearingId}?action=sign-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, sizeBytes: file.size })
      });
      const signed = await signResponse.json().catch(() => null);
      if (!signResponse.ok || !signed?.signedUrl) {
        throw new Error(signed?.detail || signed?.error || "No se pudo preparar la subida.");
      }

      await uploadToBucket(signed.signedUrl, file, setProgress);

      const registerResponse = await fetch(`/api/hearings/${hearingId}?action=documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: signed.storagePath,
          fileName: file.name,
          contentType: file.type || undefined,
          sizeBytes: file.size
        })
      });
      if (!registerResponse.ok) {
        const payload = await registerResponse.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo registrar el documento.");
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
      const response = await fetch(`/api/hearings/${hearingId}?docId=${documentId}`, { method: "DELETE" });
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

  if (!canUpload && documents.length === 0) return null;

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black text-white">
          <Paperclip className="h-4 w-4 text-[#1f89f6]" />
          Documentos adjuntos
        </p>
        {canUpload ? (
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
              {uploading ? (progress > 0 && progress < 100 ? `Subiendo… ${progress}%` : "Subiendo…") : "Subir documento"}
            </button>
          </>
        ) : null}
      </div>

      {error ? <p className="mb-2 text-xs font-bold text-amber-200">{error}</p> : null}

      {documents.length ? (
        <div className="grid gap-2">
          {documents.map((document) => (
            // min-w-0: sin el, un nombre de archivo largo estira la columna del
            // grid (min-width: auto del item) y desborda la pagina, porque
            // `truncate` recorta lo visible pero no lo que el texto mide. Mismo
            // bug que ya mordio en los antecedentes de la reforma.
            <div key={document.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
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
                {canDelete ? (
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
