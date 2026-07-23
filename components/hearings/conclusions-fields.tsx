"use client";

import { importanceOptions, type HearingConclusions } from "@/lib/hearings/shared";

/**
 * Grilla editable de la Ficha 2 (conclusiones y temas observados). Presentacional:
 * la comparten el cierre en vivo (ClosingReview) y la edicion desde el detalle.
 */
export function ConclusionsFields({
  value,
  disabled = false,
  onChange
}: {
  value: HearingConclusions;
  disabled?: boolean;
  onChange: (conclusions: HearingConclusions) => void;
}) {
  function set<K extends keyof HearingConclusions>(key: K, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Area label="Resumen general" value={value.summary} disabled={disabled} onChange={(v) => set("summary", v)} />
      <Area label="Acuerdos alcanzados" value={value.agreements} disabled={disabled} onChange={(v) => set("agreements", v)} />
      <Area label="Desacuerdos detectados" value={value.disagreements} disabled={disabled} onChange={(v) => set("disagreements", v)} />
      <Area label="Próximos pasos" value={value.nextSteps} disabled={disabled} onChange={(v) => set("nextSteps", v)} />
      <Area label="Recomendaciones técnicas" value={value.technicalRecommendations} disabled={disabled} onChange={(v) => set("technicalRecommendations", v)} />
      <Area label="Decisiones tomadas" value={value.decisions} disabled={disabled} onChange={(v) => set("decisions", v)} />
      <Text label="Estado posterior de la propuesta" value={value.proposalStatusAfter} disabled={disabled} onChange={(v) => set("proposalStatusAfter", v)} placeholder="En tratamiento" />
      <Text label="Temas observados" value={value.observedTopics} disabled={disabled} onChange={(v) => set("observedTopics", v)} placeholder="Altura, densidad, accesibilidad…" />
      <label className="grid gap-1.5">
        <Label>Importancia de los temas</Label>
        <select
          value={value.importance}
          disabled={disabled}
          onChange={(event) => set("importance", event.target.value)}
          className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50 disabled:opacity-60"
        >
          {importanceOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <Area label="Observación técnica" value={value.technicalObservation} disabled={disabled} onChange={(v) => set("technicalObservation", v)} />
      <Area label="Observación ciudadana" value={value.citizenObservation} disabled={disabled} onChange={(v) => set("citizenObservation", v)} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{children}</span>;
}

function Area({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-sky-300/50 disabled:opacity-60"
      />
    </label>
  );
}

function Text({
  label,
  value,
  disabled,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
      />
    </label>
  );
}
