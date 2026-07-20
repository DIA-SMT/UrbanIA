"use client";

import { Loader2, Sparkles } from "lucide-react";

/**
 * Bloque 2: objeto de la norma (que se quiere regular y por que), escrito en
 * crudo. Desde aca arranca el paso 1 del flujo: "Formalizar con IA" convierte
 * este texto en el articulado formal.
 */
export function ObjectBlock({
  value,
  disabled,
  canFormalize,
  formalizing,
  onChange,
  onFormalize
}: {
  value: string;
  disabled: boolean;
  canFormalize: boolean;
  formalizing: boolean;
  onChange: (value: string) => void;
  onFormalize: () => void;
}) {
  return (
    <div className="grid gap-3">
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        placeholder="Escribí en crudo qué querés que esta norma regule, cambie o mejore, y por qué. Ej.: limitar las alturas sobre corredores residenciales porque el código vigente permite torres que rompen la escala barrial. Después la IA lo formaliza como articulado."
        className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
      />

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onFormalize}
            disabled={!canFormalize || formalizing}
            className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {formalizing ? "Formalizando el articulado..." : "Formalizar con IA"}
          </button>
          <p className="text-xs text-slate-500">
            {canFormalize
              ? "Convierte este objeto en el texto formal del articulado, en la terminología del CPU 2014."
              : "Necesitás título y un objeto de al menos 40 caracteres."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
