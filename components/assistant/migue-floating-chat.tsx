"use client";

import { useState } from "react";
import Image from "next/image";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { MarkdownText } from "@/components/assistant/markdown-text";

type LiveAssistantAnswer = {
  answer: string;
  model: string;
  provider: "openrouter";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MigueFloatingChatProps = {
  appearance?: "dark" | "light";
};

const starterPrompts = [
  "Tengo una idea para mi barrio, ayudame a ordenarla",
  "Resumi una audiencia y separa reclamos y compromisos",
  "Que datos necesito para analizar documentos aportados?"
];

export function MigueFloatingChat({ appearance = "dark" }: MigueFloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function askMigue(event?: React.FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const nextQuestion = (prompt ?? draftQuestion).trim();

    if (nextQuestion.length < 3) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: nextQuestion }];

    setMessages(nextMessages);
    setDraftQuestion("");
    setStatus("loading");

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          history: messages.slice(-8),
          assistantContext: {
            mode: "public",
            module: "asistente",
            role: "citizen",
            page: "Widget global de Migue",
            intent: "consulta en lenguaje natural"
          },
          context: "Widget global de Migue dentro de UrbanIA. Responder breve, claro y orientado a accion."
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Migue no pudo responder ahora.");
      }

      setMessages([...nextMessages, { role: "assistant", content: (payload as LiveAssistantAnswer).answer }]);
      setStatus("idle");
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Migue no pudo responder ahora."
        }
      ]);
      setStatus("error");
    }
  }

  return (
    <div className={`migue-theme-${appearance} fixed bottom-24 right-4 z-[80] flex flex-col items-end gap-3 md:right-6 lg:bottom-6`}>
      {isOpen ? (
        <section className="urban-card w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-lg border-sky-300/25 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/80 p-3">
            <div className="migue-avatar">
              <span className="migue-avatar-bg" />
              <Image
                src="/migue/migue-assistant-transparent.png"
                alt=""
                width={128}
                height={128}
                className="migue-avatar-image"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Migue</p>
              <p className="text-xs font-semibold text-slate-400">Asistente urbano de UrbanIA</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="urban-button rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-300"
              aria-label="Cerrar chat de Migue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
            <div className="rounded-lg border border-sky-300/20 bg-sky-300/10 p-3">
              <p className="text-sm font-black text-sky-100">Hola, soy Migue.</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">Escribime como hablas normalmente y te ayudo a ordenar la consulta.</p>
            </div>

            <div className="grid gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => askMigue(undefined, prompt)}
                  className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-bold leading-5 text-slate-300"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {messages.length ? (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
                    className={`rounded-lg border p-3 ${
                      message.role === "user"
                        ? "ml-6 border-white/10 bg-white/[0.04]"
                        : status === "error" && index === messages.length - 1
                          ? "mr-6 border-amber-300/20 bg-amber-300/10"
                          : "mr-6 border-sky-300/20 bg-slate-950/50"
                    }`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {message.role === "user" ? "Tu consulta" : "Migue"}
                    </p>
                    <div className="mt-1">
                      {message.role === "user" ? (
                        <p className="text-sm leading-6 text-slate-200">{message.content}</p>
                      ) : (
                        <MarkdownText text={message.content} compact />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {status === "loading" ? (
              <div className="flex items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/10 p-3 text-sm font-semibold text-sky-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Migue esta analizando...
              </div>
            ) : null}

          </div>

          <form onSubmit={askMigue} className="flex items-center gap-2 border-t border-white/10 bg-slate-950/80 p-3">
            <input
              value={draftQuestion}
              onChange={(event) => setDraftQuestion(event.target.value)}
              placeholder="Preguntale a Migue..."
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/50"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="urban-button rounded-md bg-civic-blue p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Enviar consulta a Migue"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </section>
      ) : null}

      <button
        onClick={() => setIsOpen((current) => !current)}
        className="urban-button migue-launcher group"
        aria-label="Abrir chat de Migue"
        title="Migue"
      >
        <span className="migue-launcher-bg" />
        <span className="migue-launcher-frame" />
        <Image
          src="/migue/migue-assistant-transparent.png"
          alt=""
          width={160}
          height={160}
          className="migue-launcher-image"
        />
        <span className="migue-launcher-badge">
          {isOpen ? <Bot className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}
