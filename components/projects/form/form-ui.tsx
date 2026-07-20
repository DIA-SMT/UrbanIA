"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Bloque numerado del formulario (una sola pantalla, bloques apilados).
 *
 * `collapsible` existe para las secciones secundarias: seis bloques pesados abiertos
 * a la vez tapaban lo principal. Arrancan cerradas y se abren cuando hacen falta.
 */
export function FormBlock({
  index,
  title,
  description,
  action,
  collapsible = false,
  defaultOpen = true,
  children
}: {
  index: number;
  title: string;
  description?: string;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);

  const heading = (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-civic-blue/15 text-sm font-bold text-sky-200">{index}</span>
      <div className="text-left">
        <h2 className="text-base font-bold leading-tight text-white">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
    </div>
  );

  return (
    <section className="urban-card rounded-lg p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {collapsible ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="flex flex-1 items-start gap-3 text-left" aria-expanded={open}>
            {heading}
            <ChevronDown className={`ml-auto mt-1 h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          heading
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{children}</span>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
