"use client";

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { GuidedTour, useGuidedTour, type TourStep } from "@/components/help/guided-tour";

/**
 * Lanzador + motor del recorrido guiado para UNA pantalla del sistema interno.
 * Es el equivalente al botón "¿Cómo funciona?" del portal público, pero acá el
 * tema no viaja por props: el AppShell lo maneja con la clase `dark` en <html>,
 * así que se lee del DOM y se sigue con un observer (el usuario puede cambiar
 * de tema con el recorrido abierto).
 *
 * Se monta desde páginas de servidor: los `data-tour` de los elementos pueden
 * venir renderizados en el servidor, porque el motor los busca en el DOM.
 */
export function PageTour({
  tourId,
  steps,
  label = "¿Cómo funciona?"
}: {
  /** Identifica el recorrido para recordar si ya se vio (localStorage). */
  tourId: string;
  steps: TourStep[];
  label?: string;
}) {
  const tour = useGuidedTour(tourId);
  const [isLight, setIsLight] = useState(true);

  useEffect(() => {
    const update = () => setIsLight(!document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={tour.start}
        title="Recorrido guiado por esta pantalla"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
      >
        <CircleHelp className="h-4 w-4" />
        {label}
      </button>
      <GuidedTour steps={steps} open={tour.open} onClose={tour.close} isLight={isLight} />
    </>
  );
}
