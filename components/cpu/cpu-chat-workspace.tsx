"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, PanelLeftOpen } from "lucide-react";
import { CpuChatPanel } from "@/components/cpu/cpu-chat";
import { CpuConversationList } from "@/components/cpu/cpu-conversation-list";
import type { ChatAttachment } from "@/components/shared/use-attachment";
import type { ChatMessage, Citation, ConversationSummary, DocumentRef } from "@/components/cpu/types";

type View = "active" | "archived";

let localCounter = 0;
function localId() {
  localCounter += 1;
  return `local-${localCounter}`;
}

function asCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is { number: string; title: string } => Boolean(item) && typeof item === "object" && "number" in item)
    .map((item) => ({ number: String(item.number), title: String(item.title ?? "") }));
}

function asDocuments(value: unknown): DocumentRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is { label: string; page?: number; source?: string } => Boolean(item) && typeof item === "object" && "label" in item)
    .map((item) => ({ label: String(item.label), page: typeof item.page === "number" ? item.page : undefined, source: String(item.source ?? "") }));
}

export function CpuChatWorkspace({ onOpenArticle }: { onOpenArticle: (articleNumber: string) => void }) {
  const [view, setView] = useState<View>("active");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const fetchList = useCallback(async (target: View) => {
    setListLoading(true);
    try {
      const response = await fetch(`/api/cpu/conversations?archived=${target === "archived"}`);
      const payload = await response.json();
      setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
    } catch {
      setConversations([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(view);
  }, [view, fetchList]);

  function newChat() {
    setCurrentId(null);
    setMessages([]);
    setMobileListOpen(false);
    if (view !== "active") {
      setView("active");
    }
  }

  async function selectConversation(id: string) {
    setMobileListOpen(false);
    setCurrentId(id);
    setMessages([]);
    try {
      const response = await fetch(`/api/cpu/conversations/${id}`);
      if (!response.ok) {
        throw new Error("No se pudo abrir la conversación.");
      }
      const payload = await response.json();
      const loaded: ChatMessage[] = (payload.messages ?? []).map((message: Record<string, unknown>) => ({
        id: String(message.id),
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? ""),
        citations: asCitations(message.citations),
        retrieved: asCitations(message.retrieved),
        documents: asDocuments(message.retrieved),
        isError: Boolean(message.isError)
      }));
      setMessages(loaded);
    } catch {
      setMessages([
        { id: localId(), role: "assistant", content: "No se pudo abrir la conversación. Intentá de nuevo.", isError: true }
      ]);
    }
  }

  async function send(question: string, attachment?: ChatAttachment) {
    // El mismo marcador que guarda el servidor, para que la conversación se vea
    // igual ahora y al reabrirla desde el historial.
    const displayContent = attachment ? `${question}\n\n[Archivo adjuntado: ${attachment.name}]` : question;
    setMessages((current) => [...current, { id: localId(), role: "user", content: displayContent }]);
    setIsSending(true);

    try {
      const response = await fetch("/api/cpu/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          ...(currentId ? { conversationId: currentId } : {}),
          ...(attachment ? { attachment: { name: attachment.name, text: attachment.text, truncated: attachment.truncated } } : {})
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "No se pudo completar la consulta.");
      }

      setMessages((current) => [
        ...current,
        {
          id: localId(),
          role: "assistant",
          content: payload.answer ?? "No se pudo generar una respuesta.",
          citations: asCitations(payload.citations),
          retrieved: asCitations(payload.retrieved),
          documents: asDocuments(payload.documents)
        }
      ]);

      if (!currentId && payload.conversationId) {
        setCurrentId(payload.conversationId);
      }
      // La consulta creó o actualizó una conversación activa: refrescamos el listado.
      if (view === "active") {
        void fetchList("active");
      } else {
        setView("active");
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: localId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "No se pudo completar la consulta.",
          isError: true
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function archiveConversation(id: string, archived: boolean) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/cpu/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived })
      });
      if (!response.ok) {
        throw new Error("No se pudo archivar.");
      }
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (id === currentId) {
        setCurrentId(null);
        setMessages([]);
      }
    } catch {
      void fetchList(view);
    } finally {
      setBusyId(null);
    }
  }

  async function renameConversation(id: string, title: string) {
    // Optimista: actualizamos el título en la lista y revertimos si falla.
    const previous = conversations;
    setConversations((current) => current.map((conversation) => (conversation.id === id ? { ...conversation, title } : conversation)));
    try {
      const response = await fetch(`/api/cpu/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        throw new Error("No se pudo renombrar.");
      }
    } catch {
      setConversations(previous);
    }
  }

  async function deleteConversation(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/cpu/conversations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("No se pudo eliminar.");
      }
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (id === currentId) {
        setCurrentId(null);
        setMessages([]);
      }
    } catch {
      void fetchList(view);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileListOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Historial ({conversations.length})
        </button>
        <button type="button" onClick={newChat} className="primary-button inline-flex">
          <MessageSquarePlus className="h-4 w-4" />
          Nueva
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${mobileListOpen ? "block" : "hidden"} lg:block`}>
          <CpuConversationList
            conversations={conversations}
            currentId={currentId}
            view={view}
            loading={listLoading}
            busyId={busyId}
            onNewChat={newChat}
            onSelect={selectConversation}
            onChangeView={setView}
            onArchive={archiveConversation}
            onDelete={deleteConversation}
            onRename={renameConversation}
          />
        </div>

        <CpuChatPanel messages={messages} isLoading={isSending} onSend={send} onOpenArticle={onOpenArticle} />
      </div>
    </div>
  );
}
