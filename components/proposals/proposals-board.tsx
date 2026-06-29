"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Gauge,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  ThumbsUp,
  X
} from "lucide-react";
import { urbanProjects, type ProjectLayer, type ProjectOrigin, type ProjectStatus, type UrbanProject } from "@/lib/demo/urban-projects";

const STORAGE_KEY = "urbania-proposals";

const statusOptions: Array<ProjectStatus | "Todas"> = ["Todas", "En analisis", "Planificado", "En ejecucion", "Realizado"];
const layerOptions: Array<ProjectLayer | "Todas"> = ["Todas", "Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"];
const originOptions: Array<ProjectOrigin | "Todas"> = ["Todas", "Gabinete", "Area tecnica", "Concejo", "Audiencia publica", "Cidituc", "Normativa", "Caso comparado"];
const formOriginOptions: ProjectOrigin[] = ["Gabinete", "Area tecnica", "Concejo", "Audiencia publica", "Cidituc", "Normativa", "Caso comparado"];
const formLayerOptions: ProjectLayer[] = ["Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"];
const formStatusOptions: ProjectStatus[] = ["En analisis", "Planificado", "En ejecucion", "Realizado"];
const reviewStatusOptions = ["Pendiente tecnico", "En revision normativa", "Observada", "Apta para escenario", "Elevada a gabinete"];

const statusStyles: Record<ProjectStatus, string> = {
  "En analisis": "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Planificado: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  "En ejecucion": "border-sky-300/20 bg-sky-300/10 text-sky-200",
  Realizado: "border-violet-300/20 bg-violet-300/10 text-violet-200"
};

const layerStyles: Record<ProjectLayer, string> = {
  Transporte: "bg-sky-400/15 text-sky-200",
  "Espacios verdes": "bg-sky-400/15 text-sky-200",
  Equipamiento: "bg-orange-400/15 text-orange-200",
  Zonificacion: "bg-violet-400/15 text-violet-200",
  Riesgos: "bg-rose-400/15 text-rose-200"
};

const originStyles: Record<ProjectOrigin, string> = {
  Gabinete: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  "Area tecnica": "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  Concejo: "border-violet-300/20 bg-violet-300/10 text-violet-100",
  "Audiencia publica": "border-amber-300/20 bg-amber-300/10 text-amber-100",
  Cidituc: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  Normativa: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  "Caso comparado": "border-orange-300/20 bg-orange-300/10 text-orange-100"
};

type ProposalForm = {
  title: string;
  description: string;
  neighborhood: string;
  author: string;
  responsible: string;
  origin: ProjectOrigin;
  promoterArea: string;
  layer: ProjectLayer;
  status: ProjectStatus;
  reviewStatus: string;
  codeRelation: string;
  technicalJustification: string;
  documentation: string[];
};

const emptyForm: ProposalForm = {
  title: "",
  description: "",
  neighborhood: "",
  author: "",
  responsible: "Planeamiento Urbano",
  origin: "Gabinete",
  promoterArea: "Planeamiento Urbano",
  layer: "Zonificacion",
  status: "En analisis",
  reviewStatus: "Pendiente tecnico",
  codeRelation: "",
  technicalJustification: "",
  documentation: []
};

export function ProposalsBoard() {
  const [projects, setProjects] = useState<UrbanProject[]>(urbanProjects);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "Todas">("Todas");
  const [layer, setLayer] = useState<ProjectLayer | "Todas">("Todas");
  const [origin, setOrigin] = useState<ProjectOrigin | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState(urbanProjects[0]?.id ?? "");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ProposalForm>(emptyForm);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const storedProjects = JSON.parse(saved) as UrbanProject[];
      setProjects([...storedProjects, ...urbanProjects]);
      setSelectedId(storedProjects[0]?.id ?? urbanProjects[0]?.id ?? "");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const userProjects = useMemo(() => projects.filter((project) => project.id.startsWith("proposal-")), [projects]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userProjects));
  }, [userProjects]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return projects.filter((project) => {
      const searchableValues = [
        project.title,
        project.neighborhood,
        project.description,
        project.responsible,
        project.author,
        getProjectOrigin(project),
        project.promoterArea ?? project.responsible,
        project.codeRelation ?? "",
        project.technicalJustification ?? "",
        project.aiNormativeImpact ?? ""
      ];
      const matchesQuery = normalized ? searchableValues.some((value) => value.toLowerCase().includes(normalized)) : true;
      const matchesStatus = status === "Todas" || project.status === status;
      const matchesLayer = layer === "Todas" || project.layer === layer;
      const matchesOrigin = origin === "Todas" || getProjectOrigin(project) === origin;

      return matchesQuery && matchesStatus && matchesLayer && matchesOrigin;
    });
  }, [projects, query, status, layer, origin]);

  const selectedProject = filteredProjects.find((project) => project.id === selectedId) ?? filteredProjects[0] ?? projects[0];
  const activeProjects = projects.filter((project) => project.status !== "Realizado").length;
  const cabinetProjects = projects.filter((project) => getProjectOrigin(project) === "Gabinete").length;
  const technicalProjects = projects.filter((project) => getProjectOrigin(project) === "Area tecnica").length;

  function updateForm<K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = form.title.trim();
    const trimmedDescription = form.description.trim();
    const trimmedNeighborhood = form.neighborhood.trim();
    const trimmedAuthor = form.author.trim();
    const trimmedCodeRelation = form.codeRelation.trim();
    const trimmedJustification = form.technicalJustification.trim();

    if (!trimmedTitle || !trimmedDescription || !trimmedNeighborhood || !trimmedAuthor || !trimmedCodeRelation || !trimmedJustification) {
      return;
    }

    const proposal: UrbanProject = {
      id: `proposal-${Date.now()}`,
      title: trimmedTitle,
      layer: form.layer,
      status: form.status,
      neighborhood: trimmedNeighborhood,
      author: trimmedAuthor,
      responsible: form.responsible.trim() || "Planeamiento Urbano",
      origin: form.origin,
      promoterArea: form.promoterArea.trim() || form.responsible.trim() || "Planeamiento Urbano",
      description: trimmedDescription,
      objective: trimmedJustification,
      impact: buildImpactList(form.layer, trimmedCodeRelation),
      risks: buildRiskList(form.layer, form.documentation),
      nextSteps: ["Revision tecnica", "Cruce normativo", "Validacion documental", "Informe para gabinete"],
      votes: 0,
      comments: 0,
      budget: "A estimar",
      timeline: "Pendiente de evaluacion",
      position: [-26.8241, -65.2226],
      codeRelation: trimmedCodeRelation,
      technicalJustification: trimmedJustification,
      attachedDocuments: form.documentation,
      reviewStatus: form.reviewStatus,
      aiNormativeImpact: buildNormativeImpact({
        ...form,
        title: trimmedTitle,
        description: trimmedDescription,
        neighborhood: trimmedNeighborhood,
        author: trimmedAuthor,
        codeRelation: trimmedCodeRelation,
        technicalJustification: trimmedJustification
      })
    };

    setProjects((current) => [proposal, ...current]);
    setSelectedId(proposal.id);
    setForm(emptyForm);
    setIsFormOpen(false);
  }

  return (
    <div className="space-y-4">
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
              <Sparkles className="h-4 w-4" />
              Gestion urbana
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">Propuestas urbanas</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Cartera oficial de iniciativas urbanas surgidas de gabinete, areas tecnicas, Concejo, audiencias o insumos de Cidituc.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Activas" value={activeProjects.toString()} icon={Gauge} />
              <MetricCard label="Origen gabinete" value={cabinetProjects.toString()} icon={ThumbsUp} />
              <MetricCard label="Area tecnica" value={technicalProjects.toString()} icon={MessageSquare} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Flujo recomendado</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Reunion o area promotora, evaluacion tecnica, escenario e informe para gabinete.</p>
              </div>
              <span className="rounded-md bg-sky-400/15 px-3 py-1 text-xs font-black text-sky-200">MVP</span>
            </div>
            <div className="mt-4 grid gap-2">
              {["Definir origen", "Vincular reunion", "Cruzar normativa", "Preparar escenario"].map((step, index) => (
                <div key={step} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-400/15 text-xs font-black text-sky-200">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-200">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isFormOpen ? (
        <ProposalFormPanel
          form={form}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          onUpdate={updateForm}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="urban-card rounded-lg p-4 lg:p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_190px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por barrio, area o propuesta..."
                className="h-14 w-full rounded-md border border-white/10 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50"
              />
            </label>
            <SelectFilter label="Estado" value={status} options={statusOptions} onChange={(value) => setStatus(value as ProjectStatus | "Todas")} />
            <SelectFilter label="Capa urbana" value={layer} options={layerOptions} onChange={(value) => setLayer(value as ProjectLayer | "Todas")} />
            <SelectFilter label="Origen" value={origin} options={originOptions} onChange={(value) => setOrigin(value as ProjectOrigin | "Todas")} />
            <button
              onClick={() => setIsFormOpen(true)}
              className="urban-button inline-flex h-14 items-center justify-center gap-2 rounded-md bg-civic-blue px-4 text-sm font-black text-white"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProposalCard key={project.id} project={project} selected={project.id === selectedProject.id} onSelect={() => setSelectedId(project.id)} />
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              No hay propuestas con esos filtros. Proba cambiar la busqueda o la capa urbana.
            </div>
          ) : null}
        </div>

        <ProposalDetail project={selectedProject} />
      </section>
    </div>
  );
}

function ProposalFormPanel({
  form,
  onClose,
  onSubmit,
  onUpdate
}: {
  form: ProposalForm;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => void;
}) {
  return (
    <section className="urban-card rounded-lg p-4 lg:p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Nueva propuesta</p>
          <h2 className="mt-2 text-2xl font-black text-white">Registro urbano con analisis normativo</h2>
        </div>
        <button onClick={onClose} className="urban-button rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-300" aria-label="Cerrar formulario">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <TextInput label="Titulo de la propuesta" value={form.title} onChange={(value) => onUpdate("title", value)} required />
          <TextInput label="Ubicacion" value={form.neighborhood} onChange={(value) => onUpdate("neighborhood", value)} placeholder="Barrio, corredor o punto urbano" required />
          <TextInput label="Actor proponente" value={form.author} onChange={(value) => onUpdate("author", value)} placeholder="Gabinete, area municipal, Concejo o Cidituc" required />
          <TextInput label="Area responsable" value={form.responsible} onChange={(value) => onUpdate("responsible", value)} />
          <SelectInput label="Origen" value={form.origin} options={formOriginOptions} onChange={(value) => onUpdate("origin", value as ProjectOrigin)} />
          <TextInput label="Area promotora" value={form.promoterArea} onChange={(value) => onUpdate("promoterArea", value)} />
          <SelectInput label="Capa urbana" value={form.layer} options={formLayerOptions} onChange={(value) => onUpdate("layer", value as ProjectLayer)} />
          <SelectInput label="Estado de revision" value={form.reviewStatus} options={reviewStatusOptions} onChange={(value) => onUpdate("reviewStatus", value)} />
          <SelectInput label="Estado del proyecto" value={form.status} options={formStatusOptions} onChange={(value) => onUpdate("status", value as ProjectStatus)} />
        </div>

        <TextArea label="Descripcion" value={form.description} onChange={(value) => onUpdate("description", value)} required />
        <TextArea
          label="Relacion con el Codigo de Planeamiento Urbano"
          value={form.codeRelation}
          onChange={(value) => onUpdate("codeRelation", value)}
          placeholder="Indicar distrito, uso, retiro, altura, FOT/FOS, movilidad, riesgo o criterio aplicable."
          required
        />
        <TextArea
          label="Justificacion tecnica"
          value={form.technicalJustification}
          onChange={(value) => onUpdate("technicalJustification", value)}
          placeholder="Fundamento urbano, problema detectado, evidencia y beneficio esperado."
          required
        />

        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Documentacion adjunta</span>
          <input
            type="file"
            multiple
            onChange={(event) => onUpdate("documentation", Array.from(event.target.files ?? []).map((file) => file.name))}
            className="w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-civic-blue file:px-3 file:py-2 file:text-sm file:font-black file:text-white"
          />
          <span className="text-xs leading-5 text-slate-500">En este MVP se registran los nombres de archivo para dejar trazabilidad documental.</span>
        </label>

        <div className="rounded-lg border border-sky-300/20 bg-sky-300/10 p-4">
          <p className="text-sm font-black text-sky-100">Analisis automatico de impacto normativo</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{buildNormativeImpact(form)}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
            Cancelar
          </button>
          <button type="submit" className="urban-button rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
            Registrar propuesta
          </button>
        </div>
      </form>
    </section>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Gauge }) {
  return (
    <div className="urban-lift rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-civic-sky">
        <Icon className="h-4 w-4" />
        <p className="text-2xl font-black">{value}</p>
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <span className="pointer-events-none absolute left-10 top-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full appearance-none rounded-md border border-white/10 bg-slate-950/70 pb-2 pl-10 pr-3 pt-6 text-sm font-black text-slate-100 outline-none transition hover:border-sky-300/25 focus:border-sky-300/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProposalCard({ project, selected, onSelect }: { project: UrbanProject; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`urban-lift group rounded-lg border p-4 text-left transition ${
        selected ? "border-sky-300/45 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:border-sky-300/25"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[project.status]}`}>{project.status}</span>
        <span className={`rounded-md px-2.5 py-1 text-[11px] font-black ${layerStyles[project.layer]}`}>{project.layer}</span>
        <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${originStyles[getProjectOrigin(project)]}`}>{getProjectOrigin(project)}</span>
      </div>
      <h3 className="text-base font-black leading-6 text-white group-hover:text-sky-100">{project.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{project.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {project.neighborhood}
        </span>
        <span className="inline-flex items-center gap-3 text-slate-300">
          <span>{project.votes} apoyos</span>
          <span>{project.comments} com.</span>
        </span>
      </div>
    </button>
  );
}

function ProposalDetail({ project }: { project: UrbanProject }) {
  return (
    <aside className="urban-card rounded-lg p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Detalle seleccionado</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-white">{project.title}</h2>
        </div>
        <span className={`shrink-0 rounded-md border px-3 py-1 text-xs font-black ${statusStyles[project.status]}`}>{project.status}</span>
      </div>

      <p className="text-sm leading-6 text-slate-300">{project.objective}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat label="Apoyos" value={project.votes.toString()} icon={ThumbsUp} />
        <MiniStat label="Comentarios" value={project.comments.toString()} icon={MessageSquare} />
        <MiniStat label="Plazo" value={project.timeline} icon={Clock3} />
        <MiniStat label="Presupuesto" value={project.budget} icon={BarChart3} />
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <DetailBlock label="Origen" value={getProjectOrigin(project)} />
        <DetailBlock label="Area promotora" value={project.promoterArea ?? project.responsible} />
        <DetailBlock label="Actor proponente" value={project.author} />
        <DetailBlock label="Ubicacion" value={project.neighborhood} />
        <DetailBlock label="Estado de revision" value={project.reviewStatus ?? project.status} />
        <DetailBlock label="Relacion CPU" value={project.codeRelation ?? "Pendiente de carga normativa"} />
        <DetailBlock label="Justificacion tecnica" value={project.technicalJustification ?? project.objective} />
        {project.linkedMeetingId ? <DetailBlock label="Reunion vinculada" value={project.linkedMeetingId.replace("gabinete-", "")} /> : null}
      </div>

      {project.linkedMeetingId ? (
        <Link
          href="/gabinete"
          className="urban-button mt-5 inline-flex w-full items-center justify-between rounded-md border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm font-black text-sky-100"
        >
          Ver reunion vinculada
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
      <div className="mt-5 rounded-lg border border-sky-300/20 bg-sky-300/10 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-black text-sky-100">
          <Sparkles className="h-4 w-4" />
          Analisis IA de impacto normativo
        </p>
        <p className="text-sm leading-6 text-slate-300">{project.aiNormativeImpact ?? "Sin analisis automatico cargado para esta propuesta."}</p>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-sm font-black text-white">Documentacion adjunta</p>
        {project.attachedDocuments?.length ? (
          <div className="space-y-2">
            {project.attachedDocuments.map((document) => (
              <div key={document} className="flex items-center gap-2 text-sm text-slate-300">
                <FileText className="h-4 w-4 text-sky-300" />
                {document}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin documentacion adjunta registrada.</p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-sm font-black text-white">Proximas acciones</p>
        <div className="space-y-2">
          {project.nextSteps.map((step) => (
            <div key={step} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-sky-300" />
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <Link href={`/escenarios/${project.id}`} className="urban-button inline-flex items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
          <Sparkles className="h-4 w-4" />
          Convertir en escenario
        </Link>
        <Link href={`/proyectos/${project.id}`} className="urban-button inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
          Abrir ficha completa
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
      />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={4}
        className="w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
      />
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ThumbsUp }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-civic-sky" />
      <p className="text-sm font-black leading-5 text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function getProjectOrigin(project: UrbanProject): ProjectOrigin {
  return project.origin ?? "Area tecnica";
}
function buildNormativeImpact(form: ProposalForm) {
  const codeRelation = form.codeRelation.trim();
  const justification = form.technicalJustification.trim();
  const base = codeRelation
    ? `La propuesta requiere contrastar ${codeRelation} con parametros vigentes del Codigo de Planeamiento Urbano`
    : "El analisis queda pendiente hasta completar la relacion con el Codigo de Planeamiento Urbano";
  const technical = justification
    ? "La justificacion tecnica aporta insumos para evaluar factibilidad, compatibilidad de uso y mitigaciones."
    : "Falta justificacion tecnica para estimar factibilidad y mitigaciones.";
  const documentation = form.documentation.length
    ? `Cuenta con ${form.documentation.length} documento(s) adjunto(s) para trazabilidad.`
    : "Conviene adjuntar planos, fotos, antecedentes o informes para respaldar la revision.";

  return `${base}. Capa principal: ${form.layer}. ${technical} ${documentation} Recomendacion IA: mantener estado "${form.reviewStatus}" hasta completar revision tecnica y normativa.`;
}

function buildImpactList(layer: ProjectLayer, codeRelation: string) {
  return [`Impacto principal en ${layer.toLowerCase()}`, "Cruce preliminar con Codigo de Planeamiento Urbano", codeRelation];
}

function buildRiskList(layer: ProjectLayer, documentation: string[]) {
  const risks = ["Requiere validacion normativa", "Puede necesitar ajustes tecnicos"];

  if (!documentation.length) {
    risks.push("Documentacion insuficiente");
  }

  if (layer === "Riesgos") {
    risks.push("Necesita coordinacion preventiva interarea");
  }

  return risks;
}
