"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Compass, X } from "lucide-react";

/**
 * Recorrido guiado sobre la pantalla real: una tarjeta flotante que va llevando
 * de seccion en seccion, resaltando el elemento del que habla y scrolleando
 * hasta el. El patron es el del visualizador de Carteleria (referencia del
 * equipo): pasos N/M, puntos de progreso, Anterior/Siguiente, Saltar recorrido
 * y un cierre que recuerda donde relanzarlo.
 *
 * Motor propio y no una libreria de tours: son ~150 lineas, respeta los dos
 * temas del portal y no suma una dependencia por algo asi de chico.
 *
 * Cada paso puede anclarse a un elemento real via `anchor`, que busca
 * [data-tour="<anchor>"] en el DOM. Si el elemento no esta (por ejemplo, el
 * menu que se oculta en mobile), el paso se muestra igual, solo que sin
 * resaltar nada: el recorrido nunca se rompe por layout.
 */

export type TourStep = {
  /** Valor del atributo data-tour del elemento a resaltar. Sin el, la tarjeta va sola. */
  anchor?: string;
  title: string;
  body: string;
};

/**
 * Estado del recorrido de UNA pantalla. Auto-arranca la primera visita (se
 * recuerda en el navegador) y despues queda disponible via start() — el boton
 * "¿Como funciona?".
 */
export function useGuidedTour(tourId: string): { open: boolean; start: () => void; close: () => void } {
  const [open, setOpen] = useState(false);
  const storageKey = `urbania-tour-${tourId}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      return; // Sin storage (incognito estricto): no auto-arranca, el boton queda.
    }
    // Con delay: que la pantalla termine de pintar antes de arrancar el tour.
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [storageKey]);

  const start = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Sin storage se repetira el auto-arranque: molesto pero inofensivo.
    }
  }, [storageKey]);

  return { open, start, close };
}

const HIGHLIGHT_STYLE = "0 0 0 3px rgba(31, 137, 246, 0.85), 0 0 0 8px rgba(31, 137, 246, 0.25)";

/**
 * Boton "¿Como funciona?" para las pantallas DENTRO del AppShell (tema por
 * clase dark, por eso las clases duales). El portal tiene el suyo propio en
 * PortalHeader, que se estila con la bandera isLight.
 */
export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Recorrido guiado por esta pantalla"
      className="urban-button inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-sky-300/40 dark:hover:text-sky-200"
    >
      <CircleHelp className="h-4 w-4" />
      <span className="hidden sm:inline">¿Cómo funciona?</span>
    </button>
  );
}

export function GuidedTour({
  steps,
  open,
  onClose,
  isLight
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  /**
   * El PORTAL maneja el tema con esta bandera (no con la clase dark): pasarla
   * ahi. Dentro del AppShell NO pasarla: sin ella, la tarjeta usa las clases
   * duales (dark:) y sigue el tema de la app sola.
   */
  isLight?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const highlightedRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    const element = highlightedRef.current;
    if (element) {
      element.style.boxShadow = "";
      element.style.borderRadius = "";
      highlightedRef.current = null;
    }
  }, []);

  // Al abrir se arranca del primer paso; al cerrar se limpia el resaltado.
  useEffect(() => {
    if (open) setIndex(0);
    else clearHighlight();
  }, [open, clearHighlight]);

  // Resaltado + scroll del paso vigente.
  useEffect(() => {
    if (!open) return;
    clearHighlight();
    const anchor = steps[index]?.anchor;
    if (!anchor) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.style.boxShadow = HIGHLIGHT_STYLE;
    if (!element.style.borderRadius) element.style.borderRadius = "12px";
    highlightedRef.current = element;
  }, [open, index, steps, clearHighlight]);

  // Escape cierra, las flechas navegan.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open || !steps.length) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Tres variantes LITERALES por lugar (claro / oscuro / dual con dark:), no
  // clases armadas por codigo: Tailwind solo genera las que ve escritas.
  const themed = (light: string, dark: string, dual: string) => (isLight === undefined ? dual : isLight ? light : dark);

  return (
    <div
      role="dialog"
      aria-label={`Recorrido guiado: ${step.title}`}
      className="fixed inset-x-4 top-1/2 z-[70] mx-auto w-auto max-w-sm -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2"
    >
      <div
        className={`rounded-2xl border p-5 shadow-2xl ${themed(
          "border-slate-200 bg-white text-slate-900",
          "border-white/10 bg-[#0d1b2a] text-slate-100",
          "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#0d1b2a] dark:text-slate-100"
        )}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1f89f6]/12 text-[#1f89f6]">
            <Compass className="h-4.5 w-4.5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recorrido"
            className={`rounded-md p-1 transition ${themed(
              "text-slate-400 hover:text-slate-700",
              "text-slate-500 hover:text-slate-200",
              "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
            )}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-3 text-lg font-black leading-tight">{step.title}</h2>
        <p className={`mt-2 text-sm leading-6 ${themed("text-slate-600", "text-slate-300", "text-slate-600 dark:text-slate-300")}`}>
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((_, dot) => (
            <span
              key={dot}
              className={`h-1.5 rounded-full transition-all ${
                dot === index
                  ? "w-5 bg-[#1f89f6]"
                  : `w-1.5 ${themed("bg-slate-300", "bg-white/20", "bg-slate-300 dark:bg-white/20")}`
              }`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-xs font-bold tabular-nums ${themed("text-slate-400", "text-slate-500", "text-slate-400 dark:text-slate-500")}`}>
            {index + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-bold transition ${themed(
                  "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  "border-white/15 text-slate-300 hover:border-white/30 hover:text-white",
                  "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white"
                )}`}
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIndex(index + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f89f6] px-4 py-2 text-sm font-black text-white transition hover:bg-[#0066ff]"
            >
              {isLast ? "Finalizar" : "Siguiente"}
              {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isLast ? (
          <button
            type="button"
            onClick={onClose}
            className={`mx-auto mt-3 block text-xs font-semibold transition ${themed(
              "text-slate-400 hover:text-slate-600",
              "text-slate-500 hover:text-slate-300",
              "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            )}`}
          >
            Saltar recorrido
          </button>
        ) : null}
      </div>
    </div>
  );
}
