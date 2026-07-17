"use client";

import type { MunicipalArea, ProjectStatus } from "@prisma/client";
import { SelectField, TextField } from "@/components/projects/form/form-ui";
import { materiaLabels, normStatusLabels, normVisibleStatuses } from "@/lib/projects/shared";

/** Bloque 1: titulo, numero tentativo, materia (multi-select) y estado. */
export function IdentificationBlock({
  title,
  articleNumber,
  status,
  areas,
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
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <TextField label="Título de la norma" value={title} onChange={onTitleChange} placeholder="Ej. Alturas máximas en corredores de transporte" />
        <TextField label="Artículo n.º" value={articleNumber} onChange={onArticleNumberChange} placeholder="Ej. 12" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Estado"
          value={status}
          onChange={onStatusChange}
          options={statusOptions.map((value) => ({ value, label: normStatusLabels[value] }))}
        />
      </div>
      <div>
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Materia</span>
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
