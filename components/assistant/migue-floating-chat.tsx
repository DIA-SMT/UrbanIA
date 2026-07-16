"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { MarkdownText } from "@/components/assistant/markdown-text";
import { SourceCitation } from "@/components/assistant/source-citation";
import { AnswerFeedback, type FeedbackRating } from "@/components/assistant/answer-feedback";
import { ATTACHMENT_ACCEPT, formatFileSize, useAttachment } from "@/components/shared/use-attachment";
import type { AnswerSource } from "@/lib/ai/rag";

const MIGUE_HISTORY_KEY = "urbania-migue-history";
const MIGUE_POSITION_KEY = "urbania-migue-position";
// Ancho/alto aproximado del launcher (mobile 4.5rem, desktop 5rem) para encuadrarlo.
const LAUNCHER_SIZE = 84;
const EDGE_MARGIN = 8;

/** Mantiene el launcher siempre dentro de la pantalla. */
function clampToViewport(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_SIZE - EDGE_MARGIN);
  return { x: Math.min(Math.max(x, EDGE_MARGIN), maxX), y: Math.min(Math.max(y, EDGE_MARGIN), maxY) };
}

/** Direccion de apertura del panel segun el cuadrante donde quedo el launcher. */
function quadrantClass(position: { x: number; y: number }): string {
  const onLeft = position.x + LAUNCHER_SIZE / 2 < window.innerWidth / 2;
  const onTop = position.y + LAUNCHER_SIZE / 2 < window.innerHeight / 2;
  return `${onTop ? "flex-col-reverse" : "flex-col"} ${onLeft ? "items-start" : "items-end"}`;
}

/** Ancla por el borde mas cercano para que el panel crezca hacia el centro sin salirse. */
function quadrantStyle(position: { x: number; y: number }): React.CSSProperties {
  const onLeft = position.x + LAUNCHER_SIZE / 2 < window.innerWidth / 2;
  const onTop = position.y + LAUNCHER_SIZE / 2 < window.innerHeight / 2;
  const style: React.CSSProperties = {};
  if (onLeft) style.left = position.x;
  else style.right = Math.max(EDGE_MARGIN, window.innerWidth - position.x - LAUNCHER_SIZE);
  if (onTop) style.top = position.y;
  else style.bottom = Math.max(EDGE_MARGIN, window.innerHeight - position.y - LAUNCHER_SIZE);
  return style;
}

type LiveAssistantAnswer = {
  answer: string;
  model: string;
  provider: "openrouter";
  source: AnswerSource | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  source?: AnswerSource | null;
  /** Modelo que generó la respuesta; ausente en mensajes de error. */
  model?: string;
  /** Voto ya emitido, persistido para no volver a preguntar. */
  feedback?: FeedbackRating | null;
  /** Nombre del archivo que acompañó la consulta del usuario. */
  attachmentName?: string;
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
  const [hasMemory, setHasMemory] = useState(false);
  const files = useAttachment();
  const hydratedRef = useRef(false);
  // Conversación de visitas anteriores: no se muestra (el chat arranca de cero en
  // cada recarga) pero se envía como memoria para que Migue pueda retomarla si el
  // usuario hace referencia a lo que hablaron antes.
  const memoryRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; grabX: number; grabY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  // Posicion del launcher (top-left en px del viewport). null = ancla por defecto (abajo-derecha).
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Restaura la posicion guardada y la vuelve a encuadrar si cambia el tamano de ventana.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MIGUE_POSITION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") setPosition(clampToViewport(parsed.x, parsed.y));
      }
    } catch {
      // posicion corrupta: se ignora
    }
    function onResize() {
      setPosition((current) => (current ? clampToViewport(current.x, current.y) : current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onLauncherPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // El navegador puede rechazar la captura; el drag sigue funcionando igual.
    }
  }

  function onLauncherPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Umbral de 5px para distinguir un click de un arrastre.
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
      drag.moved = true;
      setDragging(true);
    }
    if (drag.moved) {
      const next = clampToViewport(event.clientX - drag.grabX, event.clientY - drag.grabY);
      lastPosRef.current = next;
      setPosition(next);
    }
  }

  function onLauncherPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // sin captura activa
    }
    dragRef.current = null;
    if (drag.moved) {
      setDragging(false);
      if (lastPosRef.current) {
        try {
          window.localStorage.setItem(MIGUE_POSITION_KEY, JSON.stringify(lastPosRef.current));
        } catch {
          // storage bloqueado
        }
      }
    } else {
      setIsOpen((value) => !value);
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MIGUE_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          memoryRef.current = parsed
            .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
            .map((item) => ({ role: item.role, content: item.content }));
          setHasMemory(memoryRef.current.length > 0);
        }
      }
    } catch {
      // historial corrupto: se ignora
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  // Guardamos memoria previa + conversación actual (recortada) para la próxima visita.
  useEffect(() => {
    if (!hydratedRef.current || !messages.length) {
      return;
    }
    try {
      const combined = [...memoryRef.current, ...messages.map(({ role, content }) => ({ role, content }))].slice(-30);
      window.localStorage.setItem(MIGUE_HISTORY_KEY, JSON.stringify(combined));
    } catch {
      // sin espacio o storage bloqueado: se ignora
    }
  }, [messages]);

  // La memoria de visitas anteriores viaja como turnos reales del historial (los
  // modelos los usan nativamente): se completa el cupo de 10 mensajes con lo más
  // reciente de la conversación actual y, si queda lugar, con la memoria previa.
  function buildHistoryWithMemory(current: ChatMessage[]) {
    const recent = current.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    const remaining = 10 - recent.length;
    const memory =
      remaining > 0
        ? memoryRef.current.slice(-remaining).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }))
        : [];
    return [...memory, ...recent];
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (isOpen && container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, status, isOpen]);

  function registerFeedback(messageIndex: number, rating: FeedbackRating) {
    setMessages((current) =>
      current.map((message, index) => (index === messageIndex ? { ...message, feedback: rating } : message))
    );
  }

  function clearHistory() {
    setMessages([]);
    setStatus("idle");
    memoryRef.current = [];
    setHasMemory(false);
    try {
      window.localStorage.removeItem(MIGUE_HISTORY_KEY);
    } catch {
      // se ignora
    }
  }

  async function askMigue(event?: React.FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const nextQuestion = (prompt ?? draftQuestion).trim();

    if (nextQuestion.length < 3) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: nextQuestion, attachmentName: files.attachment?.name }
    ];

    setMessages(nextMessages);
    setDraftQuestion("");
    setStatus("loading");

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          history: buildHistoryWithMemory(messages),
          attachment: files.attachment
            ? { name: files.attachment.name, text: files.attachment.text, truncated: files.attachment.truncated }
            : undefined,
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

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: (payload as LiveAssistantAnswer).answer,
          source: (payload as LiveAssistantAnswer).source ?? null,
          model: (payload as LiveAssistantAnswer).model,
          feedback: null
        }
      ]);
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

  // Ancla el contenedor segun el cuadrante del launcher para que el panel abra hacia el centro.
  const dockClass = position === null ? "bottom-24 right-4 md:right-6 lg:bottom-6 flex-col items-end" : quadrantClass(position);
  const dockStyle: React.CSSProperties = position === null ? {} : quadrantStyle(position);

  return (
    <div className={`migue-theme-${appearance} fixed z-[80] flex gap-3 ${dockClass}`} style={dockStyle}>
      {isOpen ? (
        <section className="flex max-h-[calc(100dvh-10rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(2,6,23,0.35)] dark:border-white/10 dark:bg-[#0d1b2a]">
          <div className="flex shrink-0 items-center gap-3 bg-gradient-to-br from-[#35aeea] via-[#1f89f6] to-[#0d6fe0] p-4">
            <span className="migue-launcher-avatar">
              <Image
                src="/migue/migue-assistant-transparent.png"
                alt=""
                width={96}
                height={96}
                className="migue-launcher-image"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Migue</p>
              <p className="text-xs font-semibold text-sky-100">Asistente urbano de UrbanIA</p>
            </div>
            {messages.length || hasMemory ? (
              <button
                onClick={clearHistory}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Borrar historial de Migue"
                title="Borrar historial y memoria"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Cerrar chat de Migue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 dark:border-sky-400/20 dark:bg-sky-400/10">
              <p className="text-sm font-black text-sky-900 dark:text-sky-100">Hola, soy Migue.</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Escribime como hablas normalmente y te ayudo a ordenar la consulta.</p>
            </div>

            {messages.length === 0 ? (
              <div className="grid gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => askMigue(undefined, prompt)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold leading-5 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}

            {messages.length ? (
              <div className="space-y-3">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div
                      key={`user-${index}-${message.content.slice(0, 16)}`}
                      className="ml-8 rounded-2xl rounded-br-md bg-[#1f89f6] px-4 py-3 shadow-[0_6px_16px_rgba(31,137,246,0.25)]"
                    >
                      <p className="text-sm leading-6 text-white">{message.content}</p>
                      {message.attachmentName ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-sky-100">
                          <Paperclip className="h-3 w-3" />
                          {message.attachmentName}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      key={`assistant-${index}-${message.content.slice(0, 16)}`}
                      className={`mr-8 rounded-2xl rounded-bl-md border px-4 py-3 ${
                        status === "error" && index === messages.length - 1
                          ? "border-amber-200 bg-amber-50 dark:border-amber-300/20 dark:bg-amber-300/10"
                          : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.05]"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-600 dark:text-sky-300">Migue</p>
                      <div className="mt-1">
                        <MarkdownText text={message.content} compact tone="adaptive" />
                      </div>
                      {message.source ? <SourceCitation source={message.source} /> : null}
                      {message.model ? (
                        <AnswerFeedback
                          question={messages[index - 1]?.role === "user" ? messages[index - 1].content : ""}
                          answer={message.content}
                          sourceReference={message.source?.reference ?? null}
                          model={message.model}
                          initialRating={message.feedback}
                          onRated={(rating) => registerFeedback(index, rating)}
                        />
                      ) : null}
                    </div>
                  )
                )}
              </div>
            ) : null}

            {status === "loading" ? (
              <div className="mr-8 flex items-center gap-2 rounded-2xl rounded-bl-md border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Migue esta analizando...
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0a1826]">
            {files.attachment ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 dark:border-sky-400/25 dark:bg-sky-400/10">
                <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {files.attachment.name}
                  <span className="ml-1.5 font-semibold text-slate-400 dark:text-slate-500">
                    {formatFileSize(files.attachment.sizeBytes)}
                    {files.attachment.truncated ? " · recortado" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={files.clear}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
                  aria-label="Quitar archivo adjunto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            {files.error ? (
              <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
                {files.error}
              </p>
            ) : null}
            <form onSubmit={askMigue} className="flex items-center gap-2">
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
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-400 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10 dark:hover:text-sky-300"
                aria-label="Adjuntar archivo (PDF o TXT, hasta 5 MB)"
                title="Adjuntar archivo (PDF o TXT, hasta 5 MB)"
              >
                {files.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <input
                value={draftQuestion}
                onChange={(event) => setDraftQuestion(event.target.value)}
                placeholder="Preguntale a Migue..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400/50 dark:focus:ring-sky-400/20"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1f89f6] text-white shadow-[0_6px_16px_rgba(31,137,246,0.35)] transition hover:bg-[#087bec] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Enviar consulta a Migue"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        ref={launcherRef}
        onPointerDown={onLauncherPointerDown}
        onPointerMove={onLauncherPointerMove}
        onPointerUp={onLauncherPointerUp}
        style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
        className={`urban-button migue-launcher group ${dragging ? "select-none" : ""}`}
        aria-label={isOpen ? "Cerrar chat de Migue" : "Abrir chat de Migue. Manten presionado para moverlo."}
        title="Migue · arrastralo para moverlo"
      >
        <span className="migue-launcher-avatar">
          <Image
            src="/migue/migue-assistant-transparent.png"
            alt=""
            width={96}
            height={96}
            className="migue-launcher-image"
          />
        </span>
        <span className="migue-launcher-label">Migue</span>
      </button>
    </div>
  );
}
