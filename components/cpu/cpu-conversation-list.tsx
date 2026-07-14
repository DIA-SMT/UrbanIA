"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Check, Loader2, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "@/components/cpu/types";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}

export function CpuConversationList({
  conversations,
  currentId,
  view,
  loading,
  busyId,
  onNewChat,
  onSelect,
  onChangeView,
  onArchive,
  onDelete,
  onRename
}: {
  conversations: ConversationSummary[];
  currentId: string | null;
  view: "active" | "archived";
  loading: boolean;
  busyId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onChangeView: (view: "active" | "archived") => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  function startEditing(id: string, title: string) {
    setConfirmDeleteId(null);
    setEditingId(id);
    setEditValue(title);
  }

  function commitEditing() {
    if (!editingId) {
      return;
    }
    const trimmed = editValue.trim();
    const original = conversations.find((conversation) => conversation.id === editingId);
    if (trimmed && original && trimmed !== original.title) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditValue("");
  }

  return (
    <div className="surface-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-slate-200/80 p-3 dark:border-white/10">
        <button
          type="button"
          onClick={onNewChat}
          className="primary-button inline-flex w-full"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nueva consulta
        </button>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.04]">
          <ViewTab active={view === "active"} label="Activas" onClick={() => onChangeView("active")} />
          <ViewTab active={view === "archived"} label="Archivadas" onClick={() => onChangeView("archived")} />
        </div>
      </div>

      <div className="urban-scrollbar min-h-[120px] flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm leading-6 text-slate-400">
            {view === "active" ? "Todavía no tenés consultas guardadas. Empezá una nueva." : "No hay consultas archivadas."}
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => {
              const active = conversation.id === currentId;
              const busy = conversation.id === busyId;
              const confirming = conversation.id === confirmDeleteId;
              const editing = conversation.id === editingId;

              if (editing) {
                return (
                  <div
                    key={conversation.id}
                    className="rounded-lg border border-sky-300 bg-white p-2 dark:border-sky-400/30 dark:bg-[#0d1b2a]"
                  >
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitEditing();
                        } else if (event.key === "Escape") {
                          setEditingId(null);
                          setEditValue("");
                        }
                      }}
                      maxLength={120}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-[#1f89f6] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100"
                    />
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={commitEditing}
                        className="grid h-7 w-7 place-items-center rounded-md bg-[#1f89f6] text-white hover:bg-[#087bec]"
                        title="Guardar nombre"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditValue("");
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.05]"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={conversation.id}
                  className={`group relative rounded-lg border transition ${
                    active
                      ? "border-sky-300 bg-sky-50 dark:border-sky-400/30 dark:bg-sky-400/10"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    onDoubleClick={() => startEditing(conversation.id, conversation.title)}
                    className="block w-full px-3 py-2.5 pr-[5.75rem] text-left"
                  >
                    <span className="block truncate text-sm font-bold text-slate-700 dark:text-slate-200">{conversation.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {formatWhen(conversation.updatedAt)} · {conversation.messageCount} mensajes
                    </span>
                  </button>

                  {confirming ? (
                    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          onDelete(conversation.id);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md bg-rose-500 text-white hover:bg-rose-600"
                        title="Confirmar eliminación"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.05]"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEditing(conversation.id, conversation.title)}
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-sky-700 dark:hover:bg-white/10"
                        title="Renombrar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(conversation.id, !conversation.archived)}
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-sky-700 dark:hover:bg-white/10"
                        title={conversation.archived ? "Desarchivar" : "Archivar"}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : conversation.archived ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(conversation.id)}
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600 dark:hover:bg-white/10"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-xs font-bold transition ${
        active ? "bg-white text-sky-700 shadow-sm dark:bg-[#0d1b2a] dark:text-sky-200" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
