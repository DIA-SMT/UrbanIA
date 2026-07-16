"use client";

import { useState } from "react";
import { FileText, Link2, Loader2, NotebookPen, Paperclip, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ProjectAttachmentView } from "@/lib/projects/shared";

type AttachmentKind = "documento" | "apunte" | "acta";

const kindLabels: Record<AttachmentKind, string> = { documento: "Documento", apunte: "Apunte", acta: "Acta de reunion" };
const kindIcons: Record<AttachmentKind, typeof FileText> = { documento: FileText, apunte: NotebookPen, acta: Link2 };

export function ContextBlock({
  projectId,
  ensureDraft,
  meetings,
  attachments,
  onChange
}: {
  projectId: string | null;
  ensureDraft: () => Promise<string | null>;
  meetings: Array<{ id: string; title: string }>;
  attachments: ProjectAttachmentView[];
  onChange: (attachments: ProjectAttachmentView[]) => void;
}) {
  const [kind, setKind] = useState<AttachmentKind>("documento");
  const [name, setName] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    const label = kind === "acta" ? meetings.find((meeting) => meeting.id === meetingId)?.title ?? name.trim() : name.trim();
    if (kind === "acta" && !meetingId) {
      setError("Elegi el acta de reunion a vincular.");
      return;
    }
    if (!label) {
      setError("Escribi un nombre para el adjunto.");
      return;
    }
    const id = projectId ?? (await ensureDraft());
    if (!id) {
      setError("Carga titulo y descripcion (40+ caracteres) para agregar contexto.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: label, excerpt: excerpt.trim() || undefined, meetingId: kind === "acta" ? meetingId : undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo agregar el adjunto.");
      onChange([...attachments, payload.attachment as ProjectAttachmentView]);
      setName("");
      setExcerpt("");
      setMeetingId("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "No se pudo agregar el adjunto.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(attachmentId: string) {
    onChange(attachments.filter((item) => item.id !== attachmentId));
    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/attachments?attachmentId=${attachmentId}`, { method: "DELETE" });
      } catch {
        // Ya se quito de la UI.
      }
    }
  }

  return (
    <div>
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(kindLabels) as AttachmentKind[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-md px-3 py-2 text-xs font-bold transition ${kind === value ? "bg-civic-blue text-white" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"}`}
            >
              {kindLabels[value]}
            </button>
          ))}
        </div>

        {kind === "acta" ? (
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Acta de reunion</span>
            <select value={meetingId} onChange={(event) => setMeetingId(event.target.value)} className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50">
              <option value="">Elegir reunion...</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>{meeting.title}</option>
              ))}
            </select>
          </label>
        ) : (
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del documento o apunte" className="mt-3 h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50" />
        )}
        <input value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Nota o extracto (opcional)" className="mt-2 h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50" />

        <div className="mt-3 flex items-center justify-between">
          {error ? <p className="text-xs font-bold text-amber-200">{error}</p> : <span />}
          <button type="button" onClick={add} disabled={saving} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>
      </div>

      <div className="mt-4">
        {attachments.length ? (
          <div className="grid gap-2">
            {attachments.map((attachment) => {
              const Icon = kindIcons[(attachment.kind as AttachmentKind)] ?? Paperclip;
              return (
                <div key={attachment.id} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-400/10 text-sky-200"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-200">{attachment.name}</p>
                    {attachment.excerpt ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{attachment.excerpt}</p> : null}
                  </div>
                  <button type="button" onClick={() => remove(attachment.id)} className="shrink-0 text-slate-500 hover:text-rose-300" title="Quitar adjunto">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Paperclip} title="Sin contexto adjunto" description="Suma documentos, apuntes o actas de reunion que respalden el proyecto." />
        )}
      </div>
    </div>
  );
}
