"use client";

import { memo } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { actorTypeOptions, proposalSourceOptions, type HearingFicha } from "@/lib/hearings/shared";

/**
 * Ficha estructurada de la audiencia (foto 1), debajo del dictado: datos,
 * propuesta/normativa y participación. Se cargan a mano o con "Completar con
 * IA" (rellena los campos vacíos con lo que Migue detecta del dictado, sin
 * pisar lo escrito). Se autoguarda junto con la transcripción.
 */
function HearingFieldsBase({
  value,
  disabled,
  aiAvailable,
  completing,
  error,
  onChange,
  onCompleteWithAi
}: {
  value: HearingFicha;
  disabled: boolean;
  aiAvailable: boolean;
  completing: boolean;
  error: string;
  onChange: (ficha: HearingFicha) => void;
  onCompleteWithAi: () => void;
}) {
  function set<K extends keyof HearingFicha>(key: K, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">Ficha de la audiencia</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Cargá a mano o usá <span className="font-bold text-slate-300">Completar con IA</span>: Migue rellena los campos vacíos con lo que detecta del dictado. Vos corregís.
          </p>
        </div>
        {aiAvailable ? (
          <button
            type="button"
            onClick={onCompleteWithAi}
            disabled={disabled || completing}
            className="urban-button inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-black text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#1f89f6]" />}
            {completing ? "Analizando el dictado..." : "Completar con IA"}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs font-bold text-amber-200">{error}</p> : null}

      <Group title="Datos generales">
        <Field label="Temática principal">
          <Text value={value.mainTopic} disabled={disabled} onChange={(v) => set("mainTopic", v)} placeholder="Movilidad, patrimonio, uso de suelo…" />
        </Field>
        <Field label="Temáticas secundarias">
          <Text value={value.secondaryTopics} disabled={disabled} onChange={(v) => set("secondaryTopics", v)} placeholder="Separadas por comas" />
        </Field>
      </Group>

      <Group title="Propuesta y normativa">
        <Field label="Propuesta relacionada">
          <Text value={value.relatedProposal} disabled={disabled} onChange={(v) => set("relatedProposal", v)} placeholder="Propuesta que se debate" />
        </Field>
        <Field label="Origen de la propuesta">
          <Select value={value.proposalSource} disabled={disabled} onChange={(v) => set("proposalSource", v)} options={proposalSourceOptions} placeholder="Elegí un origen…" />
        </Field>
        <Field label="Autor o área impulsora">
          <Text value={value.author} disabled={disabled} onChange={(v) => set("author", v)} placeholder="Comisión de Planeamiento Urbano" />
        </Field>
        <Field label="Artículos del código">
          <Text value={value.relatedArticles} disabled={disabled} onChange={(v) => set("relatedArticles", v)} placeholder="Artículo 12, Artículo 18" />
        </Field>
      </Group>

      <Group title="Participación">
        <Field label="Participantes">
          <Text value={value.participants} disabled={disabled} onChange={(v) => set("participants", v)} placeholder="Nombres separados por comas" />
        </Field>
        <Field label="Institución">
          <Text value={value.institution} disabled={disabled} onChange={(v) => set("institution", v)} placeholder="Institución u organización" />
        </Field>
        <Field label="Rol">
          <Text value={value.role} disabled={disabled} onChange={(v) => set("role", v)} placeholder="Participante, expositor…" />
        </Field>
        <Field label="Tipo de actor">
          <Select value={value.actorType} disabled={disabled} onChange={(v) => set("actorType", v)} options={actorTypeOptions} placeholder="Elegí un tipo…" />
        </Field>
      </Group>

      <div className="mt-3">
        <FieldLabel>Intervención prevista o realizada</FieldLabel>
        <textarea
          value={value.intervention}
          disabled={disabled}
          onChange={(event) => set("intervention", event.target.value)}
          rows={3}
          placeholder="Resumen de la postura o el aporte de los participantes."
          className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
        />
      </div>
    </section>
  );
}

/**
 * Memoizado: son once inputs controlados que no dependen del dictado, y sin
 * esto se re-evaluaban varias veces por segundo mientras el operador dicta.
 */
export const HearingFields = memo(HearingFieldsBase);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-sky-300">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{children}</span>;
}

function Text({
  value,
  disabled,
  placeholder,
  onChange
}: {
  value: string;
  disabled: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50 disabled:opacity-60"
    />
  );
}

function Select({
  value,
  disabled,
  options,
  placeholder,
  onChange
}: {
  value: string;
  disabled: boolean;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50 disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}
