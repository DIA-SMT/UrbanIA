"use client";

import type { MunicipalArea, ProjectStatus } from "@prisma/client";
import { AuthorPicker } from "@/components/normas/author-picker";
import { FieldLabel, SelectField, TextField } from "@/components/projects/form/form-ui";
import { materiaLabels, normStatusLabels, normVisibleStatuses } from "@/lib/projects/shared";

/** Bloque 1: autor, titulo, numero tentativo, materia (multi-select) y estado. */
export function IdentificationBlock({
  title,
  articleNumber,
  status,
  areas,
  authorName,
  accountName,
  knownAuthors,
  disabled,
  onTitleChange,
  onArticleNumberChange,
  onStatusChange,
  onToggleArea,
  onAuthorNameChange
}: {
  title: string;
  articleNumber: string;
  status: ProjectStatus;
  areas: MunicipalArea[];
  authorName: string;
  accountName: string | null;
  /** Gente que ya firmo una norma o devolucion, para elegirse sin reescribir. */
  knownAuthors: string[];
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onArticleNumberChange: (value: string) => void;
  onStatusChange: (value: ProjectStatus) => void;
  onToggleArea: (area: MunicipalArea) => void;
  onAuthorNameChange: (value: string) => void;
}) {
  // Si la fila trae un estado de obra heredado, se muestra igual para no ocultarlo.
  const statusOptions = normVisibleStatuses.includes(status) ? normVisibleStatuses : [...normVisibleStatuses, status];

  return (
    <div className="grid gap-3">
      {/* Primero el autor: la cuenta es institucional y compartida, asi que sin este
          dato todas las normas de una direccion quedan firmadas igual. */}
      <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <FieldLabel>Autor de la norma *</FieldLabel>
            <AuthorPicker
              value={authorName}
              knownNames={knownAuthors}
              disabled={disabled}
              placeholder="Nombre y apellido de quien redacta"
              onChange={onAuthorNameChange}
            />
          </label>
          {accountName ? (
            <p className="pb-3 text-[11px] leading-5 text-slate-500">
              Cuenta: <span className="font-semibold text-slate-400">{accountName}</span>
            </p>
          ) : null}
        </div>
        {/* El aviso de obligatorio es para quien edita; en modo lectura solo mete ruido. */}
        {!disabled ? (
          <p className={`mt-2 text-[11px] leading-5 ${authorName.trim() ? "text-slate-500" : "text-amber-200/80"}`}>
            {authorName.trim()
              ? "La norma queda firmada con este nombre, además de la cuenta."
              : "Obligatorio: la norma no se guarda hasta que cargues quién la redacta."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <TextField label="Título de la norma" value={title} disabled={disabled} onChange={onTitleChange} placeholder="Ej. Alturas máximas en corredores de transporte" />
        <TextField label="Artículo n.º" value={articleNumber} disabled={disabled} onChange={onArticleNumberChange} placeholder="Ej. 12" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Estado"
          value={status}
          disabled={disabled}
          onChange={onStatusChange}
          options={statusOptions.map((value) => ({ value, label: normStatusLabels[value] }))}
        />
      </div>
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Materia</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(materiaLabels) as MunicipalArea[]).map((area) => {
            const active = areas.includes(area);
            return (
              <button
                key={area}
                type="button"
                disabled={disabled}
                onClick={() => onToggleArea(area)}
                className={`rounded-md border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  active ? "border-[#1f89f6] bg-civic-blue/15 text-sky-100" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
                }`}
              >
                {materiaLabels[area]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
