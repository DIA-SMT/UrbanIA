"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { LegalSections } from "@/components/public/legal-body";
import { LEGAL_BETA_NOTICE, LEGAL_UPDATED_AT, LEGAL_VERSION, PRIVACY, TERMS } from "@/lib/legal/content";

type Slug = "terminos" | "privacidad";

const DOCS = { terminos: TERMS, privacidad: PRIVACY } as const;

/** Elementos que pueden recibir foco dentro del recuadro. */
const FOCUSABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Enlace que abre el documento legal en un recuadro sobre la pantalla, en vez de
 * llevarse a la persona a otra página.
 *
 * Por qué así: estos enlaces aparecen en el pie del portal y, sobre todo, en la
 * pantalla de ingreso, justo antes de entrar. Navegar a otra pantalla ahí es
 * pedirle a alguien que abandone lo que estaba haciendo para leer la letra
 * chica; la mayoría no vuelve.
 *
 * Las páginas completas NO se eliminan: el recuadro ofrece "abrir en una
 * pestaña". Sirven para enlazar desde afuera, citarlas en un expediente e
 * imprimirlas. El recuadro es la lectura cómoda; la página sigue siendo el
 * documento.
 */
export function LegalLink({
  documento,
  children,
  isLight = true,
  className
}: {
  documento: Slug;
  children: React.ReactNode;
  isLight?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={disparador}
        type="button"
        onClick={() => setAbierto(true)}
        className={className}
        aria-haspopup="dialog"
      >
        {children}
      </button>
      {abierto ? (
        <LegalDialog
          inicial={documento}
          isLight={isLight}
          onClose={() => {
            setAbierto(false);
            // El foco vuelve al enlace: si no, quien navega con teclado queda al
            // principio del documento y tiene que recorrerlo entero de nuevo.
            disparador.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

function LegalDialog({
  inicial,
  isLight,
  onClose
}: {
  inicial: Slug;
  isLight: boolean;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState<Slug>(inicial);
  const [montado, setMontado] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const doc = DOCS[slug];

  // createPortal necesita el document, que en el render del servidor no existe.
  useEffect(() => setMontado(true), []);

  const alTeclado = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      // Trampa de foco: sin esto, tabular sale del recuadro hacia la página de
      // atrás, que esta tapada y no se puede ver. Quien navega con teclado
      // quedaria perdido sin saber por que.
      const focusables = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLES));
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", alTeclado);
    // La página de atrás no debe scrollear mientras el recuadro está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>(FOCUSABLES)?.focus();

    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [alTeclado]);

  // Al cambiar de documento el texto vuelve arriba: si no, se abre la Política
  // por la mitad, en el punto donde habia quedado el scroll de los Terminos.
  useEffect(() => {
    if (cuerpo.current) cuerpo.current.scrollTop = 0;
  }, [slug]);

  if (!montado) return null;

  /*
   * Va al <body> con createPortal y NO donde esta el enlace.
   *
   * Los disparadores viven en el pie del portal y en un parrafo de la pantalla
   * de ingreso, y los dos tienen `text-center`: montado ahi, el documento entero
   * salia CENTRADO y el pie del recuadro se le encimaba al texto. Se vio en la
   * captura, no en el codigo.
   *
   * Ademas evita el problema de fondo: un `position: fixed` dentro de un
   * ancestro con transform, filter u overflow:hidden se ancla al ancestro y no a
   * la ventana, asi que el recuadro podria quedar recortado segun donde se lo
   * ponga. Al <body> no le pasa.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#08121f]/60 p-4 text-left backdrop-blur-[2px]"
      onMouseDown={(event) => {
        // mouseDown y no click: con click, arrastrar una selección de texto desde
        // adentro y soltar afuera cerraba el recuadro y se perdía la lectura.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-[0_24px_60px_rgba(2,6,23,0.35)] ${
          isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0d1b2a]"
        }`}
      >
        <div className={`shrink-0 border-b px-5 pt-4 ${isLight ? "border-slate-200" : "border-white/10"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={tituloId}
                className={`font-display text-lg font-extrabold tracking-[-0.01em] ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {doc.title}
              </h2>
              <p className={`mt-0.5 text-[11px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                Versión {LEGAL_VERSION} · Actualizado el {LEGAL_UPDATED_AT}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                isLight ? "text-slate-500 hover:bg-slate-100" : "text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Las dos solapas en el mismo recuadro: en la pantalla de ingreso la
              frase menciona los dos documentos, y así se pasa de uno al otro sin
              cerrar y volver a abrir. */}
          <div role="tablist" aria-label="Documentos" className="mt-3 flex gap-1">
            {(Object.keys(DOCS) as Slug[]).map((clave) => {
              const activa = clave === slug;
              return (
                <button
                  key={clave}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setSlug(clave)}
                  className={`border-b-2 px-3 py-2 text-[13px] font-bold transition ${
                    activa
                      ? isLight
                        ? "border-civic-blue-deep text-slate-900"
                        : "border-sky-300 text-white"
                      : `border-transparent ${isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"}`
                  }`}
                >
                  {DOCS[clave].title}
                </button>
              );
            })}
          </div>
        </div>

        {/*
          El area de scroll ES el flex item: `min-h-0 flex-1 overflow-y-auto`.
          Dos intentos previos fallaron y vale anotarlos: con un contenedor
          intermedio y `h-full` adentro, el 100% se resolvia contra la altura
          ESPECIFICADA del padre --`auto` en un flex item-- y el area crecia con
          el texto (2630 px en un hueco de 596), encimando el pie sobre el
          documento; con `absolute inset-0` la caja quedaba definida pero dejaba
          de aportar altura y el recuadro entero colapsaba a 170 px.
        */}
        <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p
              className={`mb-4 rounded-xl border px-3 py-2 text-[11.5px] leading-6 ${
                isLight
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-amber-300/25 bg-amber-300/10 text-amber-100"
              }`}
            >
              {LEGAL_BETA_NOTICE}
            </p>
            <p className={`mb-4 text-[12.5px] leading-6 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
              {doc.intro}
            </p>
            <LegalSections sections={doc.sections} isLight={isLight} compacto />
            {/* Degradado que avisa que el texto sigue. Va DENTRO del area de
                scroll, pegado con `sticky bottom-0`, y con margen superior
                negativo para tapar la ultima linea en vez de sumar alto. Asi no
                depende de saber cuanto mide el pie del recuadro. */}
            <div
              aria-hidden
              className={`pointer-events-none sticky bottom-0 -mt-10 h-10 ${
                isLight
                  ? "bg-gradient-to-t from-white to-transparent"
                  : "bg-gradient-to-t from-[#0d1b2a] to-transparent"
              }`}
            />
          </div>

        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-t px-5 py-2.5 ${
            isLight ? "border-slate-200 bg-slate-50/60" : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <Link
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              isLight ? "text-civic-blue-deep" : "text-sky-300"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir en una pestaña
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-4 py-1.5 text-[13px] font-bold transition ${
              isLight
                ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                : "border-white/15 text-slate-200 hover:bg-white/[0.06]"
            }`}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
