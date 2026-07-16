"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MunicipalArea, ProjectStage, ProjectStatus } from "@prisma/client";
import { ArrowLeft, Building2, FileDown, Landmark, Loader2, Pencil, RefreshCw, Trash2, Wallet, X } from "lucide-react";
import { NormativeAnchorBlock } from "@/components/projects/form/normative-anchor-block";
import { BudgetBlock } from "@/components/projects/form/budget-block";
import { DiagnosisPanel } from "@/components/projects/diagnosis-panel";
import { exportBudgetPdf, exportDiagnosisPdf } from "@/components/projects/export-pdf";
import {
  municipalAreaLabels,
  projectStageLabels,
  projectStatusLabels,
  projectStatusStyles,
  proposalSourceLabels,
  type ProjectAnchorView,
  type ProjectBudgetItemView,
  type ProjectDetail as ProjectDetailData,
  type ProjectDiagnosisView
} from "@/lib/projects/shared";

export function ProjectDetail({
  project,
  canEdit,
  canDelete,
  cabinetMeetings
}: {
  project: ProjectDetailData;
  canEdit: boolean;
  canDelete: boolean;
  cabinetMeetings: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();

  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [stage, setStage] = useState<ProjectStage>(project.stage);
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  const [areas, setAreas] = useState<MunicipalArea[]>(project.areas);
  const [addressLabel, setAddressLabel] = useState(project.addressLabel ?? "");
  const [officialNotes, setOfficialNotes] = useState(project.officialNotes ?? "");
  const [requiresEIA, setRequiresEIA] = useState(project.requiresEIA);
  const [eiaNotes, setEiaNotes] = useState(project.eiaNotes ?? "");

  const [anchors, setAnchors] = useState<ProjectAnchorView[]>(project.anchors);
  const [budgetItems, setBudgetItems] = useState<ProjectBudgetItemView[]>(project.budgetItems);
  const [diagnoses, setDiagnoses] = useState<ProjectDiagnosisView[]>(project.diagnoses);
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string | null>(project.diagnoses[0]?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [elevateOpen, setElevateOpen] = useState(false);
  const [error, setError] = useState("");

  const ensureDraft = useMemo(() => async () => project.id, [project.id]);
  const selectedDiagnosis = diagnoses.find((entry) => entry.id === selectedDiagnosisId) ?? diagnoses[0] ?? null;
  const primaryArea = areas[0] ? municipalAreaLabels[areas[0]] : "Sin area";

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail || payload?.error || "No se pudo guardar el cambio.");
    }
  }

  async function changeStatus(next: ProjectStatus) {
    setStatus(next);
    setError("");
    try {
      await patch({ status: next });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.");
    }
  }

  async function changeStage(next: ProjectStage) {
    setStage(next);
    setError("");
    try {
      await patch({ stage: next });
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : "No se pudo cambiar la etapa.");
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    setError("");
    try {
      await patch({
        title: title.trim(),
        summary: summary.trim(),
        areas,
        addressLabel: addressLabel.trim() || null,
        officialNotes: officialNotes.trim() || null,
        requiresEIA,
        eiaNotes: eiaNotes.trim() || null
      });
      setEditing(false);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "No se pudo guardar.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/diagnose`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo regenerar.");
      const diagnosis = payload.diagnosis as ProjectDiagnosisView;
      setDiagnoses((current) => [diagnosis, ...current]);
      setSelectedDiagnosisId(diagnosis.id);
    } catch (regenError) {
      setError(regenError instanceof Error ? regenError.message : "No se pudo regenerar el diagnostico.");
    } finally {
      setRegenerating(false);
    }
  }

  async function remove() {
    if (!window.confirm("Eliminar este proyecto de forma permanente?")) return;
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.push("/proyectos");
    } catch {
      setError("No se pudo eliminar el proyecto.");
    }
  }

  function toggleArea(area: MunicipalArea) {
    setAreas((current) => (current.includes(area) ? current.filter((entry) => entry !== area) : [...current, area]));
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/proyectos" className="inline-flex items-center gap-1 hover:text-slate-200"><ArrowLeft className="h-4 w-4" />Proyectos</Link>
        <span>/</span>
        <span className="truncate text-slate-300">{title}</span>
      </div>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-slate-400">{project.code}</p>
            {editing ? (
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-2xl font-black text-white outline-none focus:border-sky-300/50" />
            ) : (
              <h1 className="mt-1 text-2xl font-black leading-tight text-white md:text-3xl">{title}</h1>
            )}
            <p className="mt-1 text-sm text-slate-400">{primaryArea} · {projectStageLabels[stage]} · {proposalSourceLabels[project.source]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={status} onChange={(event) => changeStatus(event.target.value as ProjectStatus)} disabled={!canEdit} className={`rounded-md border px-2.5 py-1.5 text-xs font-black outline-none ${projectStatusStyles[status]} disabled:opacity-70`}>
              {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((value) => (
                <option key={value} value={value} className="bg-[#0d1b2a] text-white">{projectStatusLabels[value]}</option>
              ))}
            </select>
            {canEdit ? (
              <button type="button" onClick={() => (editing ? saveEdit() : setEditing(true))} disabled={savingEdit} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-3 py-2 text-sm font-black text-white disabled:opacity-60">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {editing ? "Guardar" : "Editar"}
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" onClick={remove} className="urban-button inline-flex items-center gap-2 rounded-md border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-bold text-rose-100">
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            ) : null}
          </div>
        </div>

        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Etapa</span>
            <select value={stage} onChange={(event) => changeStage(event.target.value as ProjectStage)} className="rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none">
              {(Object.keys(projectStageLabels) as ProjectStage[]).map((value) => (
                <option key={value} value={value}>{projectStageLabels[value]}</option>
              ))}
            </select>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs font-bold text-amber-200">{error}</p> : null}
      </section>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Descripcion</h2>
        {editing ? (
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={6} className="mt-3 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none focus:border-sky-300/50" />
        ) : (
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">{summary}</p>
        )}

        <h3 className="mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">Areas municipales</h3>
        {editing ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(municipalAreaLabels) as MunicipalArea[]).map((area) => (
              <button key={area} type="button" onClick={() => toggleArea(area)} className={`rounded-md border px-2.5 py-1.5 text-xs font-bold ${areas.includes(area) ? "border-[#1f89f6] bg-civic-blue/15 text-sky-100" : "border-white/10 bg-white/[0.02] text-slate-400"}`}>{municipalAreaLabels[area]}</button>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {areas.length ? areas.map((area) => <span key={area} className="rounded bg-sky-400/10 px-2 py-0.5 text-[11px] font-bold text-sky-200">{municipalAreaLabels[area]}</span>) : <span className="text-sm text-slate-500">Sin areas asignadas.</span>}
          </div>
        )}

        <h3 className="mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">Ubicacion</h3>
        {editing ? (
          <input value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} placeholder="Direccion o referencia" className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-sky-300/50" />
        ) : (
          <p className="mt-2 text-sm text-slate-300">{addressLabel || "Sin ubicacion registrada."}{project.latitude && project.longitude ? ` (${project.latitude.toFixed(5)}, ${project.longitude.toFixed(5)})` : ""}</p>
        )}
      </section>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Normativa de referencia</h2>
        <div className="mt-3">
          <NormativeAnchorBlock projectId={project.id} ensureDraft={ensureDraft} anchors={anchors} onChange={setAnchors} />
        </div>
      </section>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Diagnostico tecnico</h2>
          <div className="flex flex-wrap items-center gap-2">
            {diagnoses.length > 1 ? (
              <select value={selectedDiagnosisId ?? ""} onChange={(event) => setSelectedDiagnosisId(event.target.value)} className="rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none">
                {diagnoses.map((entry) => (
                  <option key={entry.id} value={entry.id}>Version {entry.version}{entry.editedByHuman ? " (editado)" : ""} · {new Date(entry.createdAt).toLocaleDateString("es-AR")}</option>
                ))}
              </select>
            ) : null}
            {canEdit ? (
              <button type="button" onClick={regenerate} disabled={regenerating} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-60">
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerar
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3">
          {selectedDiagnosis ? (
            <DiagnosisPanel
              projectId={project.id}
              diagnosis={selectedDiagnosis}
              canEdit={canEdit}
              onUpdated={(updated) => setDiagnoses((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Todavia no hay diagnostico.{canEdit ? " Genera uno con el boton Regenerar." : ""}</p>
          )}
        </div>
      </section>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Observaciones del equipo</h2>
        {editing ? (
          <textarea value={officialNotes} onChange={(event) => setOfficialNotes(event.target.value)} rows={4} className="mt-3 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-100 outline-none focus:border-sky-300/50" />
        ) : (
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">{officialNotes || "Sin observaciones cargadas."}</p>
        )}

        <div className="mt-5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Impacto ambiental</h3>
          {editing ? (
            <div className="mt-2">
              <label className="flex items-center gap-3">
                <button type="button" role="switch" aria-checked={requiresEIA} onClick={() => setRequiresEIA((value) => !value)} className={`relative h-6 w-11 rounded-full transition ${requiresEIA ? "bg-civic-blue" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${requiresEIA ? "left-[1.375rem]" : "left-0.5"}`} />
                </button>
                <span className="text-sm font-bold text-slate-200">Requiere evaluacion de impacto ambiental</span>
              </label>
              {requiresEIA ? <textarea value={eiaNotes} onChange={(event) => setEiaNotes(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-sky-300/50" /> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-300">{requiresEIA ? `Si. ${eiaNotes || ""}` : "No requiere."}</p>
          )}
        </div>
      </section>

      <section className="urban-card rounded-lg p-5 lg:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Presupuesto estimado</h2>
        <div className="mt-3">
          <BudgetBlock projectId={project.id} ensureDraft={ensureDraft} items={budgetItems} onChange={setBudgetItems} />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07111d]/95 px-4 py-3 backdrop-blur lg:pl-[260px]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => selectedDiagnosis && exportDiagnosisPdf({ code: project.code, title }, selectedDiagnosis)} disabled={!selectedDiagnosis} className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:opacity-50">
            <FileDown className="h-4 w-4" />
            Diagnostico PDF
          </button>
          <button type="button" onClick={() => exportBudgetPdf({ code: project.code, title }, budgetItems)} className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200">
            <Wallet className="h-4 w-4" />
            Presupuesto PDF
          </button>
          {canEdit ? (
            <button type="button" onClick={() => setElevateOpen(true)} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2.5 text-sm font-black text-white">
              <Landmark className="h-4 w-4" />
              Elevar a gabinete
            </button>
          ) : null}
        </div>
      </div>

      {elevateOpen ? (
        <ElevateModal
          projectId={project.id}
          cabinetMeetings={cabinetMeetings}
          onClose={() => setElevateOpen(false)}
          onDone={() => {
            setStage("CABINET_REVIEW");
            setElevateOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ElevateModal({
  projectId,
  cabinetMeetings,
  onClose,
  onDone
}: {
  projectId: string;
  cabinetMeetings: Array<{ id: string; title: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(cabinetMeetings.length ? "existing" : "new");
  const [meetingId, setMeetingId] = useState(cabinetMeetings[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const body =
        mode === "existing"
          ? { meetingId }
          : { newMeeting: { title: newTitle.trim(), meetingDate: newDate || new Date().toISOString() } };
      const response = await fetch(`/api/projects/${projectId}/elevate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo elevar a gabinete.");
      onDone();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo elevar a gabinete.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-white"><Building2 className="h-5 w-5 text-[#1f89f6]" />Elevar a gabinete</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">Se crea una idea de gabinete vinculada al proyecto y pasa a revision de gabinete. Elegi la reunion.</p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
          <button type="button" onClick={() => setMode("existing")} disabled={!cabinetMeetings.length} className={`rounded-md px-3 py-2 text-xs font-bold ${mode === "existing" ? "bg-civic-blue text-white" : "text-slate-300"} disabled:opacity-40`}>Reunion existente</button>
          <button type="button" onClick={() => setMode("new")} className={`rounded-md px-3 py-2 text-xs font-bold ${mode === "new" ? "bg-civic-blue text-white" : "text-slate-300"}`}>Nueva reunion</button>
        </div>

        {mode === "existing" ? (
          <select value={meetingId} onChange={(event) => setMeetingId(event.target.value)} className="mt-3 h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none">
            {cabinetMeetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>{meeting.title}</option>
            ))}
          </select>
        ) : (
          <div className="mt-3 grid gap-2">
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Titulo de la reunion de gabinete" className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none" />
            <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none" />
          </div>
        )}

        {error ? <p className="mt-3 text-xs font-bold text-amber-200">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200">Cancelar</button>
          <button type="button" onClick={submit} disabled={saving || (mode === "existing" ? !meetingId : newTitle.trim().length < 2)} className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
            Elevar
          </button>
        </div>
      </div>
    </div>
  );
}
