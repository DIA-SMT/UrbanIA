"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MunicipalArea, ProposalSource } from "@prisma/client";
import { FileDown, Loader2, Save, Send } from "lucide-react";
import type { MapPickCoords } from "@/components/map/urban-leaflet-map";
import { FormBlock, SelectField, TextField } from "@/components/projects/form/form-ui";
import { ContextBlock } from "@/components/projects/form/context-block";
import { LocationBlock } from "@/components/projects/form/location-block";
import { NormativeAnchorBlock } from "@/components/projects/form/normative-anchor-block";
import { DiagnosisBlock } from "@/components/projects/form/diagnosis-block";
import { BudgetBlock } from "@/components/projects/form/budget-block";
import { exportDiagnosisPdf } from "@/components/projects/export-pdf";
import {
  municipalAreaLabels,
  proposalSourceLabels,
  type ProjectAnchorView,
  type ProjectAttachmentView,
  type ProjectBudgetItemView,
  type ProjectDiagnosisView
} from "@/lib/projects/shared";

const MIN_SUMMARY = 40;

export function ProjectForm({
  proposals,
  meetings
}: {
  proposals: Array<{ id: string; title: string }>;
  meetings: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState<ProposalSource>(ProposalSource.TECHNICAL_TEAM);
  const [proposalId, setProposalId] = useState("");
  const [areas, setAreas] = useState<MunicipalArea[]>([]);
  const [requiresEIA, setRequiresEIA] = useState(false);
  const [eiaNotes, setEiaNotes] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [coords, setCoords] = useState<MapPickCoords | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [officialNotes, setOfficialNotes] = useState("");

  const [anchors, setAnchors] = useState<ProjectAnchorView[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachmentView[]>([]);
  const [budgetItems, setBudgetItems] = useState<ProjectBudgetItemView[]>([]);
  const [diagnosis, setDiagnosis] = useState<ProjectDiagnosisView | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const creatingRef = useRef(false);

  const canDraft = title.trim().length > 0 && summary.trim().length >= MIN_SUMMARY;

  const corePayload = useCallback(
    () => ({
      title: title.trim(),
      summary: summary.trim(),
      source,
      areas,
      requiresEIA,
      eiaNotes: eiaNotes.trim() || null,
      proposalId: proposalId || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      addressLabel: addressLabel.trim() || null,
      districtId,
      officialNotes: officialNotes.trim() || null
    }),
    [title, summary, source, areas, requiresEIA, eiaNotes, proposalId, coords, addressLabel, districtId, officialNotes]
  );

  // Crea el borrador (una sola vez) cuando hay titulo + descripcion valida.
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (projectId) return projectId;
    if (creatingRef.current) return null;
    if (!canDraft) return null;
    creatingRef.current = true;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corePayload())
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail || payload?.error || "No se pudo guardar el borrador.");
        return null;
      }
      setProjectId(payload.project.id);
      setCode(payload.project.code);
      return payload.project.id as string;
    } finally {
      creatingRef.current = false;
    }
  }, [projectId, canDraft, corePayload]);

  // Auto-persistir como borrador apenas hay titulo + descripcion valida.
  useEffect(() => {
    if (!projectId && canDraft) void ensureDraft();
  }, [projectId, canDraft, ensureDraft]);

  // Autosave de campos nucleo (debounce) una vez que existe el borrador.
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corePayload())
      }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [projectId, corePayload]);

  function toggleArea(area: MunicipalArea) {
    setAreas((current) => (current.includes(area) ? current.filter((entry) => entry !== area) : [...current, area]));
  }

  async function finalize(nextStatus: "DRAFT" | "IN_REVIEW") {
    setError("");
    setSaving(true);
    try {
      const id = await ensureDraft();
      if (!id) {
        setError("Carga titulo y una descripcion de al menos 40 caracteres.");
        return;
      }
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corePayload(), status: nextStatus })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "No se pudo guardar el proyecto.");
      }
      router.push(`/proyectos/${id}`);
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  const summaryHint = useMemo(() => {
    const length = summary.trim().length;
    if (length === 0) return "";
    if (length < MIN_SUMMARY) return `${length}/${MIN_SUMMARY} caracteres para habilitar el diagnostico`;
    return "Listo para diagnostico";
  }, [summary]);

  return (
    <div className="space-y-4 pb-28">
      <div>
        <p className="eyebrow">Cartera de proyectos</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Nuevo proyecto</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Carga todo en una sola pantalla. El proyecto se guarda como borrador apenas escribis el titulo y la descripcion; despues anclas normativa y generas el diagnostico.
          {code ? <span className="ml-2 rounded bg-white/[0.06] px-2 py-0.5 font-mono text-xs font-bold text-sky-200">{code}</span> : null}
        </p>
      </div>

      <FormBlock index={1} title="Identificacion" description="Titulo, origen y vinculo opcional con un aporte o propuesta existente.">
        <div className="grid gap-3">
          <TextField label="Titulo del proyecto" value={title} onChange={setTitle} placeholder="Ej. Ciclovia protegida Avenida Aconquija" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Origen"
              value={source}
              onChange={setSource}
              options={(Object.keys(proposalSourceLabels) as ProposalSource[]).map((value) => ({ value, label: proposalSourceLabels[value] }))}
            />
            <SelectField
              label="Vincular a propuesta / aporte"
              value={proposalId}
              onChange={setProposalId}
              options={[{ value: "", label: "Sin vinculo" }, ...proposals.map((proposal) => ({ value: proposal.id, label: proposal.title }))]}
            />
          </div>
        </div>
      </FormBlock>

      <FormBlock
        index={2}
        title="Descripcion del proyecto"
        description="Escribi libre: que se quiere hacer, donde, por que y que antecedentes hay. Despues la IA lo ordena."
        action={summaryHint ? <span className={`text-xs font-bold ${summary.trim().length >= MIN_SUMMARY ? "text-emerald-300" : "text-slate-400"}`}>{summaryHint}</span> : null}
      >
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={7}
          placeholder="Conta la situacion: que se quiere hacer, donde, por que, que antecedentes hay. Escribi libre, despues la IA lo ordena."
          className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
        />
      </FormBlock>

      <FormBlock index={3} title="Contexto adicional" description="Documentos, apuntes y actas de reunion que respaldan el proyecto.">
        <ContextBlock projectId={projectId} ensureDraft={ensureDraft} meetings={meetings} attachments={attachments} onChange={setAttachments} />
      </FormBlock>

      <FormBlock index={4} title="Areas municipales involucradas" description="Seleccion multiple de las areas que participan.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(municipalAreaLabels) as MunicipalArea[]).map((area) => {
            const active = areas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`rounded-md border px-3 py-2 text-sm font-bold transition ${active ? "border-[#1f89f6] bg-civic-blue/15 text-sky-100" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"}`}
              >
                {municipalAreaLabels[area]}
              </button>
            );
          })}
        </div>
      </FormBlock>

      <FormBlock index={5} title="Ubicacion" description="Direccion de referencia y punto en el mapa (opcional).">
        <LocationBlock addressLabel={addressLabel} coords={coords} onAddressChange={setAddressLabel} onCoordsChange={setCoords} onDistrictChange={setDistrictId} />
      </FormBlock>

      <FormBlock index={6} title="Normativa de referencia" description="Ancla los articulos exactos para que el diagnostico use su texto, no una interpretacion.">
        <NormativeAnchorBlock projectId={projectId} ensureDraft={ensureDraft} anchors={anchors} onChange={setAnchors} />
      </FormBlock>

      <FormBlock index={7} title="Diagnostico tecnico" description="La IA razona sobre la descripcion y la normativa anclada. El equipo valida y edita.">
        <DiagnosisBlock projectId={projectId} ensureDraft={ensureDraft} canGenerate={canDraft} diagnosis={diagnosis} onDiagnosis={setDiagnosis} />
      </FormBlock>

      <FormBlock index={8} title="Observaciones del equipo municipal" description="Lo que el diagnostico IA omitio o lo que quieras dejar asentado.">
        <textarea
          value={officialNotes}
          onChange={(event) => setOfficialNotes(event.target.value)}
          rows={4}
          placeholder="Agrega lo que el diagnostico IA omitio o lo que quieras dejar asentado."
          className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
        />
      </FormBlock>

      <FormBlock index={9} title="Impacto ambiental">
        <label className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={requiresEIA}
            onClick={() => setRequiresEIA((value) => !value)}
            className={`relative h-6 w-11 rounded-full transition ${requiresEIA ? "bg-civic-blue" : "bg-white/15"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${requiresEIA ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
          <span className="text-sm font-bold text-slate-200">Requiere evaluacion de impacto ambiental</span>
        </label>
        {requiresEIA ? (
          <textarea
            value={eiaNotes}
            onChange={(event) => setEiaNotes(event.target.value)}
            rows={3}
            placeholder="Detalla el alcance del impacto ambiental y que evaluacion corresponde."
            className="mt-3 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
          />
        ) : null}
      </FormBlock>

      <FormBlock index={10} title="Presupuesto estimado" description="Cada item calcula su monto como base por multiplicador.">
        <BudgetBlock projectId={projectId} ensureDraft={ensureDraft} items={budgetItems} onChange={setBudgetItems} />
      </FormBlock>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07111d]/95 px-4 py-3 backdrop-blur lg:pl-[260px]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-slate-400">
            {error ? <span className="font-bold text-amber-200">{error}</span> : code ? <span>Borrador guardado · {code}</span> : <span>El borrador se guarda solo al completar titulo y descripcion.</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => diagnosis && code && exportDiagnosisPdf({ code, title: title.trim() || "Proyecto" }, diagnosis)}
              disabled={!diagnosis}
              className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              Exportar diagnostico PDF
            </button>
            <button
              type="button"
              onClick={() => finalize("DRAFT")}
              disabled={saving || !canDraft}
              className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => finalize("IN_REVIEW")}
              disabled={saving || !canDraft}
              className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Crear proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
