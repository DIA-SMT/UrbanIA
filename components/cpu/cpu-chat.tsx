"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, BookOpen, FileText, Loader2, Paperclip, ScrollText, Send, Sparkles, X } from "lucide-react";
import { MarkdownText } from "@/components/assistant/markdown-text";
import { ATTACHMENT_ACCEPT, formatFileSize, useAttachment, type ChatAttachment } from "@/components/shared/use-attachment";
import type { ChatMessage, Citation, DocumentRef } from "@/components/cpu/types";

const SUGGESTIONS = [
  "¿Qué altura máxima permite el distrito residencial?",
  "¿Qué exige el CPU sobre estacionamiento en edificios?",
  "¿Cómo se calculan los retiros de frente y de fondo?",
  "¿Qué usos se permiten en un distrito comercial?"
];

export function CpuChatPanel({
  messages,
  isLoading,
  onSend,
  onOpenArticle
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (question: string, attachment?: ChatAttachment) => void;
  onOpenArticle: (articleNumber: string) => void;
}) {
  const [input, setInput] = useState("");
  const files = useAttachment();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (hasConversation) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isLoading, hasConversation]);

  function submit(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (question.length < 3 || isLoading) {
      return;
    }
    onSend(question, files.attachment ?? undefined);
    setInput("");
  }

  return (
    <div className="surface-panel flex min-h-[62vh] flex-col overflow-hidden">
      {hasConversation ? (
        <div className="urban-scrollbar flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onOpenArticle={onOpenArticle} />
          ))}
          {isLoading ? <ThinkingBubble /> : null}
          <div ref={bottomRef} />
        </div>
      ) : (
        <EmptyState onPick={(question) => submit(question)} disabled={isLoading} />
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="border-t border-slate-200/80 bg-slate-50/70 p-3 md:p-4 dark:border-white/10 dark:bg-white/[0.02]"
      >
        {files.attachment ? (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-400/25 dark:bg-sky-400/10">
            <FileText className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
              {files.attachment.name}
              <span className="ml-1.5 font-semibold text-slate-400 dark:text-slate-500">
                {formatFileSize(files.attachment.sizeBytes)}
                {files.attachment.truncated ? " · recortado" : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={files.clear}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
              aria-label="Quitar archivo adjunto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        {files.error ? (
          <p className="mx-auto mb-2 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
            {files.error}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-[#1f89f6] dark:border-white/10 dark:bg-[#0d1b2a]">
          <input
            ref={files.inputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            onChange={files.onFileSelected}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={files.openPicker}
            disabled={files.uploading}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-sky-400/10 dark:hover:text-sky-300"
            aria-label="Adjuntar archivo (PDF o TXT, hasta 5 MB)"
            title="Adjuntar archivo (PDF o TXT, hasta 5 MB)"
          >
            {files.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Escribí tu consulta sobre el Código de Planeamiento Urbano..."
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length < 3}
            className="primary-button inline-flex shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar consulta"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Consultar</span>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] leading-4 text-slate-400">
          Las respuestas se fundamentan en los artículos del CPU (texto ordenado a mayo de 2014). Verificá siempre la vigencia y validá con el equipo técnico.
        </p>
      </form>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (question: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center md:py-14">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white md:text-3xl">
        ¿Qué querés consultar del Código?
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        Preguntá en lenguaje natural sobre alturas, usos, distritos, retiros, estacionamiento o cualquier tema del Código de Planeamiento Urbano. Las respuestas citan los artículos reales.
      </p>
      <div className="mt-7 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="urban-lift group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left text-sm font-semibold text-slate-700 transition hover:border-sky-300 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-[#1f89f6]" />
            <span className="min-w-0 flex-1">{suggestion}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[#1f89f6]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, onOpenArticle }: { message: ChatMessage; onOpenArticle: (articleNumber: string) => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-[#1f89f6] px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.isError) {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[90%] items-start gap-2 rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  const citations = message.citations ?? [];
  const retrieved = message.retrieved ?? [];
  const documents = message.documents ?? [];
  const uncitedRetrieved = retrieved.filter((item) => !citations.some((citation) => citation.number === item.number));

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#0d1b2a]">
        <MarkdownText text={message.content} />

        {citations.length ? (
          <div className="mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Fuentes citadas</p>
            <div className="flex flex-wrap gap-2">
              {citations.map((citation) => (
                <CitationChip key={citation.number} citation={citation} highlighted onOpenArticle={onOpenArticle} />
              ))}
            </div>
          </div>
        ) : null}

        {documents.length ? (
          <div className={`${citations.length ? "mt-3" : "mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10"}`}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Fuentes documentales</p>
            <div className="flex flex-wrap gap-2">
              {documents.map((doc) => (
                <DocumentChip key={`${doc.label}-${doc.page ?? ""}`} doc={doc} />
              ))}
            </div>
          </div>
        ) : null}

        {uncitedRetrieved.length ? (
          <div className={`${citations.length || documents.length ? "mt-3" : "mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10"}`}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              {citations.length ? "Otros artículos revisados" : "Artículos revisados"}
            </p>
            <div className="flex flex-wrap gap-2">
              {uncitedRetrieved.map((citation) => (
                <CitationChip key={citation.number} citation={citation} onOpenArticle={onOpenArticle} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CitationChip({
  citation,
  highlighted = false,
  onOpenArticle
}: {
  citation: Citation;
  highlighted?: boolean;
  onOpenArticle: (articleNumber: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenArticle(citation.number)}
      title={`Ver Artículo ${citation.number} — ${citation.title}`}
      className={`inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
        highlighted
          ? "border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-400 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100"
          : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
      }`}
    >
      <ScrollText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Art. {citation.number} · {citation.title}</span>
    </button>
  );
}

function DocumentChip({ doc }: { doc: DocumentRef }) {
  return (
    <span
      title={`${doc.source}${doc.page ? ` · pág. ${doc.page}` : ""}`}
      className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[#1f89f6]" />
      <span className="truncate">{doc.label}</span>
    </span>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#0d1b2a] dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-[#1f89f6]" />
        Consultando el Código de Planeamiento...
      </div>
    </div>
  );
}
