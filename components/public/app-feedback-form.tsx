"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, MessageSquarePlus, ShieldCheck, UserRound } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import {
  PortalFooter,
  PortalHeader,
  activeChipClass,
  chipClass,
  eyebrowClass,
  labelClass,
  pageClass,
  panelClass,
  primaryButtonClass,
  usePortalTheme
} from "@/components/public/portal-chrome";
import { FEEDBACK_KINDS, KIND_HINTS, type FeedbackKindLabel } from "@/lib/feedback/shared";

/**
 * Recomendaciones sobre UrbanIA como herramienta. Misma mecanica que presentar
 * un aporte --se entra con Cidituc y el nombre sale de la cuenta-- pero otro
 * destino: esto no va al circuito de la reforma del Codigo, lo lee el equipo que
 * mantiene el portal.
 */
export function AppFeedbackForm() {
  const { isLight, toggleTheme } = usePortalTheme();
  const [kind, setKind] = useState<FeedbackKindLabel>("Sugerencia");
  const [text, setText] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // "loading" evita que el bloque de "ingresa" parpadee antes de saber si hay sesion.
  const [currentUser, setCurrentUser] = useState<{ name: string } | null | "loading">("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth?action=me", { cache: "no-store" });
        const data = (await response.json()) as { user?: { name: string } | null };
        if (isMounted) setCurrentUser(data.user ?? null);
      } catch {
        if (isMounted) setCurrentUser(null);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();

    if (value.length < 10) {
      setSaveError("Contanos un poco más: al menos 10 caracteres.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/citizen-contributions?action=feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text: value })
      });
      const result = (await response.json().catch(() => ({}))) as { feedback?: { id: string }; error?: string };

      if (!response.ok || !result.feedback) {
        throw new Error(result.error ?? "No pudimos guardar tu recomendación.");
      }

      setSaved(true);
      setText("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No pudimos guardar tu recomendación.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="sugerencias" />

      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className={eyebrowClass(isLight)}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Sobre el portal
        </div>
        <h1
          className={`mt-4 font-display text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem] ${
            isLight ? "text-slate-900" : "text-white"
          }`}
        >
          Ayudanos a mejorar UrbanIA
        </h1>
        <p className={`mt-4 max-w-2xl text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          Acá no hablamos de la ciudad sino de esta herramienta: qué te costó encontrar, qué no funcionó, qué le
          agregarías. Lo lee el equipo que la desarrolla.{" "}
          <Link href="/presentar" className={isLight ? "font-semibold text-civic-blue-deep underline-offset-4 hover:underline" : "font-semibold text-sky-300 underline-offset-4 hover:underline"}>
            Si querés proponer algo sobre la ciudad, va por acá.
          </Link>
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={panelClass(isLight)}>
            {currentUser === "loading" ? (
              <div
                className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${
                  isLight ? "border-slate-200 text-slate-400" : "border-white/10 text-slate-500"
                }`}
              >
                Verificando tu sesion...
              </div>
            ) : currentUser === null ? (
              <div
                className={
                  isLight
                    ? "rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center"
                    : "rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-6 text-center"
                }
              >
                <div
                  className={
                    isLight
                      ? "mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-civic-blue-deep"
                      : "mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-sky-200"
                  }
                >
                  <LogIn className="h-5 w-5" />
                </div>
                <h2 className={`mt-4 font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Ingresá para dejar tu recomendación
                </h2>
                <p className={`mx-auto mt-2 max-w-md text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Pedimos cuenta para poder responderte y para saber a quién le pasó cada cosa. Ingresá con Cidituc:
                  UrbanIA crea tu cuenta ciudadana automáticamente en el primer acceso.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/ingresar" className={primaryButtonClass()}>
                    <UserRound className="h-4 w-4" />
                    Ingresar con Cidituc
                  </Link>
                </div>
              </div>
            ) : saved ? (
              <div className="px-2 py-10 text-center">
                <div
                  className={
                    isLight
                      ? "mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600"
                      : "mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"
                  }
                >
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className={`mt-4 font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Gracias, lo recibimos
                </h2>
                <p className={`mx-auto mt-2 max-w-md text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Tu recomendación quedó registrada y la va a leer el equipo que mantiene el portal.
                </p>
                <button type="button" onClick={() => setSaved(false)} className={`mt-6 ${primaryButtonClass()}`}>
                  Dejar otra
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <p
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    isLight ? "bg-slate-50 text-slate-600" : "bg-white/[0.04] text-slate-300"
                  }`}
                >
                  Escribís como <span className={isLight ? "text-slate-900" : "text-white"}>{currentUser.name}</span>. Tu
                  recomendación no se publica en el portal.
                </p>

                <div>
                  <span className={labelClass(isLight)}>¿De qué se trata?</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {FEEDBACK_KINDS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setKind(option)}
                        className={kind === option ? activeChipClass(isLight) : chipClass(isLight)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <p className={`mt-2 text-xs leading-5 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                    {KIND_HINTS[kind]}
                  </p>
                </div>

                <div>
                  <label htmlFor="feedback-text" className={labelClass(isLight)}>
                    Contanos
                  </label>
                  <textarea
                    id="feedback-text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={7}
                    maxLength={4000}
                    placeholder="Ej: busque mi barrio en el codigo y no me aparecio nada, no supe si estaba buscando mal..."
                    className={
                      isLight
                        ? "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-civic-blue focus:ring-2 focus:ring-civic-blue/20"
                        : "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-300/40 focus:ring-2 focus:ring-sky-300/20"
                    }
                  />
                  <p className={`mt-1.5 text-right text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                    {text.trim().length}/4000
                  </p>
                </div>

                {saveError ? (
                  <p
                    className={`rounded-xl px-3 py-2 text-sm ${
                      isLight ? "bg-rose-50 text-rose-700" : "bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {saveError}
                  </p>
                ) : null}

                <div>
                  <button type="submit" disabled={isSaving} className={primaryButtonClass()}>
                    {isSaving ? "Enviando..." : "Enviar recomendación"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className={panelClass(isLight)}>
            <div className={eyebrowClass(isLight)}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Qué pasa con esto
            </div>
            <ul className="mt-4 grid gap-4">
              <AsideStep
                number={1}
                title="Lo lee el equipo"
                detail="Va a una bandeja interna del sistema. No se publica en el portal ni lo ven otros vecinos."
                isLight={isLight}
              />
              <AsideStep
                number={2}
                title="Se ordena por tipo"
                detail="Los problemas se revisan primero; las sugerencias entran a la lista de mejoras del portal."
                isLight={isLight}
              />
              <AsideStep
                number={3}
                title="Queda tu nombre"
                detail="Para poder volver a contactarte si hace falta entender mejor lo que contaste."
                isLight={isLight}
              />
            </ul>
          </aside>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5">
        <PortalFooter isLight={isLight} />
      </div>

      <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
    </main>
  );
}

function AsideStep({
  number,
  title,
  detail,
  isLight
}: {
  number: number;
  title: string;
  detail: string;
  isLight: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={
          isLight
            ? "grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-50 text-xs font-extrabold text-civic-blue-deep"
            : "grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-300/10 text-xs font-extrabold text-sky-200"
        }
      >
        {number}
      </span>
      <div>
        <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{title}</p>
        <p className={`mt-1 text-xs leading-5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{detail}</p>
      </div>
    </li>
  );
}
