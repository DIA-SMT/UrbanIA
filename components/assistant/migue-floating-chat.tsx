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

const starterPrompts = [
  "Que normativa aplica a una propuesta urbana?",
  "Ayudame a ordenar una propuesta ciudadana",
  "Que datos necesito para elevar esto a gabinete?"
];

export function MigueFloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function askMigue(event?: React.FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const nextQuestion = (prompt ?? question).trim();

    if (nextQuestion.length < 3) {
      return;
    }

    setQuestion(nextQuestion);
    setStatus("loading");
    setAnswer("");

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          context: "Widget global de Migue dentro de UrbanIA. Responder breve, claro y orientado a accion."
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Migue no pudo responder ahora.");
      }

      setAnswer((payload as LiveAssistantAnswer).answer);
      setStatus("idle");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Migue no pudo responder ahora.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-[80] flex flex-col items-end gap-3 md:right-6 lg:bottom-6">
      {isOpen ? (
        <section className="urban-card w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-lg border-sky-300/25 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/80 p-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-sky-300/20 bg-sky-300/10">
              <Image src="/migue/migue-assistant-transparent.png" alt="" fill sizes="56px" className="object-contain object-bottom" />
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
              <p className="mt-1 text-sm leading-6 text-slate-300">Decime que queres revisar y te ayudo a ordenar la consulta.</p>
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

            {question ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Consulta</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">{question}</p>
              </div>
            ) : null}

            {status === "loading" ? (
              <div className="flex items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/10 p-3 text-sm font-semibold text-sky-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Migue esta analizando...
              </div>
            ) : null}

            {answer ? (
              <div className={`rounded-lg border p-3 ${status === "error" ? "border-amber-300/20 bg-amber-300/10" : "border-sky-300/20 bg-slate-950/50"}`}>
                <MarkdownText text={answer} compact />
              </div>
            ) : null}
          </div>

          <form onSubmit={askMigue} className="flex items-center gap-2 border-t border-white/10 bg-slate-950/80 p-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
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
        className="urban-button group relative flex h-20 w-20 items-end justify-center overflow-hidden rounded-full border border-sky-300/30 bg-slate-950 shadow-2xl shadow-sky-950/40"
        aria-label="Consultar UrbanIA"
        title="Consultar UrbanIA"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(31,137,246,0.28),transparent_62%)]" />
        <Image src="/migue/migue-assistant-transparent.png" alt="" fill sizes="80px" className="object-contain object-bottom transition group-hover:scale-105" />
        <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-civic-blue text-white shadow-lg">
          {isOpen ? <Bot className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}
