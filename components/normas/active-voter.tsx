"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { AuthorPicker } from "@/components/normas/author-picker";

/**
 * Quien esta trabajando ahora mismo, dentro de la cuenta institucional compartida.
 *
 * Existe porque el voto se cuenta por nombre (ver la migracion
 * 20260721140000_norm_support_by_voter_name): sin saber quien vota, dos personas
 * de la misma direccion no pueden apoyar la misma norma.
 *
 * Se guarda en sessionStorage y NO en localStorage: se borra al cerrar el
 * navegador, asi la persona que abre la maquina al dia siguiente no hereda la
 * identidad de la anterior. Ademas se muestra siempre en pantalla, en vez de
 * quedar escondido dentro de un campo del formulario: la diferencia entre esto y
 * "recordar el ultimo nombre" es que aca se ve con quien estas actuando.
 */

const KEY = "urbania:votante-activo";
/** Sincroniza las instancias del hook dentro de la misma pestaña. */
const CHANGED = "urbania:votante-cambio";

export function useActiveVoter() {
  const [voter, setVoterState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setVoterState(window.sessionStorage.getItem(KEY) ?? "");
    } catch {
      // sessionStorage bloqueado: se elige de nuevo en cada pantalla.
    }
    setReady(true);

    const sync = () => {
      try {
        setVoterState(window.sessionStorage.getItem(KEY) ?? "");
      } catch {
        /* idem */
      }
    };
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  const setVoter = useCallback((name: string) => {
    setVoterState(name);
    try {
      if (name) window.sessionStorage.setItem(KEY, name);
      else window.sessionStorage.removeItem(KEY);
    } catch {
      // Sin storage la identidad vive solo en memoria; el flujo sigue igual.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { voter, setVoter, ready };
}

/** Selector visible de identidad. Sin esto no se puede votar ni opinar. */
export function ActiveVoterBar({ knownAuthors }: { knownAuthors: string[] }) {
  const { voter, setVoter, ready } = useActiveVoter();

  if (!ready) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
        voter ? "border-white/8 bg-white/[0.02]" : "border-amber-200/25 bg-amber-200/[0.04]"
      }`}
    >
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
        <UserCircle2 className="h-4 w-4 text-[#1f89f6]" />
        Trabajás como
      </span>
      <AuthorPicker value={voter} knownNames={knownAuthors} onChange={setVoter} placeholder="Tu nombre y apellido" />
      {voter ? (
        <button
          type="button"
          onClick={() => setVoter("")}
          className="text-[11px] font-semibold text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
        >
          No soy yo
        </button>
      ) : (
        <span className="text-[11px] leading-5 text-amber-200/80">
          Elegí tu nombre para poder votar y dejar devoluciones.
        </span>
      )}
    </div>
  );
}
