"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Quien firma: se elige de la lista de gente que ya firmo algo, o se escribe si
 * es la primera vez.
 *
 * Arranca SIEMPRE sin seleccion. La cuenta es institucional y compartida, asi que
 * recordar "el ultimo nombre usado" haria que la proxima persona publique firmando
 * como otra sin notarlo, que es exactamente la atribucion falsa que este campo
 * existe para evitar. Elegirse tiene que ser un acto deliberado.
 */

const OTHER = "__otra__";

export function AuthorPicker({
  value,
  knownNames,
  disabled = false,
  placeholder = "Nombre y apellido",
  onChange
}: {
  value: string;
  knownNames: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  // Escribir a mano cuando no hay lista, cuando el valor actual no esta en ella
  // (una norma vieja firmada por alguien que ya no figura), o al elegir "otra".
  const [typing, setTyping] = useState(() => !knownNames.length || (Boolean(value) && !knownNames.includes(value)));
  const inputRef = useRef<HTMLInputElement>(null);
  const justSwitched = useRef(false);

  useEffect(() => {
    if (typing && justSwitched.current) {
      justSwitched.current = false;
      inputRef.current?.focus();
    }
  }, [typing]);

  if (typing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full max-w-xs rounded-md border bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60 ${
            value.trim() ? "border-white/10" : "border-amber-200/30"
          }`}
        />
        {knownNames.length ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setTyping(false);
            }}
            className="text-[11px] font-semibold text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline"
          >
            Elegir de la lista
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <select
      value={knownNames.includes(value) ? value : ""}
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value === OTHER) {
          justSwitched.current = true;
          onChange("");
          setTyping(true);
          return;
        }
        onChange(event.target.value);
      }}
      className={`h-11 w-full max-w-xs rounded-md border bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50 disabled:opacity-60 ${
        value.trim() ? "border-white/10" : "border-amber-200/30"
      }`}
    >
      <option value="">Elegí tu nombre…</option>
      {knownNames.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={OTHER}>Otra persona…</option>
    </select>
  );
}
