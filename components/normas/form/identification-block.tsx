"use client";

import type { MunicipalArea, ProjectStatus } from "@prisma/client";
import { FieldLabel, SelectField, TextField } from "@/components/projects/form/form-ui";
import { materiaLabels, normStatusLabels, normVisibleStatuses } from "@/lib/projects/shared";

/** Bloque 1: autor, titulo, numero tentativo, materia (multi-select) y estado. */
export function IdentificationBlock({
  title,
  articleNumber,
  status,
  areas,
  authorName,
  isNew,
  disabled,
  onTitleChange,
  onArticleNumberChange,
  onStatusChange,
  onToggleArea
}: {
  title: string;
  articleNumber: string;
  status: ProjectStatus;
  areas: MunicipalArea[];
  /**
   * Quien firma. Es informativo y no se edita: en una norma existente es su
   * autor, y en una nueva la cuenta de la sesion, que es con la que el servidor
   * la va a sellar al guardarla.
   */
  authorName: string | null;
  isNew: boolean;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onArticleNumberChange: (value: string) => void;
  onStatusChange: (value: ProjectStatus) => void;
  onToggleArea: (area: MunicipalArea) => void;
}) {
  // Si la fila trae un estado de obra heredado, se muestra igual para no ocultarlo.
  const statusOptions = normVisibleStatuses.includes(status) ? normVisibleStatuses : [...normVisibleStatuses, status];

  return (
    <div className="grid gap-3">
      {/* El autor va primero pero ya no se carga: sale de la cuenta con la que se
          inicio sesion. Antes era un campo editable porque las direcciones
          compartian una cuenta institucional y el nombre era el unico dato que
          distinguia a la persona. */}
      <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
        <FieldLabel>Autor de la norma</FieldLabel>
        <p className="mt-1.5 text-sm font-bold text-slate-100">{authorName ?? "Sin autor registrado"}</p>
        {!disabled ? (
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            {isNew
              ? "Queda firmada con tu cuenta al guardarla."
              : "La firma es de quien la creó y no cambia al editarla."}
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
