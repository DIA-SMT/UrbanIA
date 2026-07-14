"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ProposalSource, ProposalStatus } from "@prisma/client";
import {
  ArrowUpRight,
  CalendarDays,
  Gauge,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  ThumbsUp,
  Users,
  X
} from "lucide-react";
import { proposalSourceLabels, proposalStatusLabels, PROJECT_STATUSES, type ProposalListItem } from "@/lib/proposals/shared";

const statusFilterOptions: Array<ProposalStatus | "Todas"> = [
  "Todas",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_DATA",
  "FEASIBLE",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED"
];

const sourceFilterOptions: Array<ProposalSource | "Todas"> = ["Todas", "CITIZEN", "OFFICIAL", "CABINET", "TECHNICAL_TEAM"];

const statusStyles: Partial<Record<ProposalStatus, string>> = {
  SUBMITTED: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  UNDER_REVIEW: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  NEEDS_DATA: "border-orange-300/20 bg-orange-300/10 text-orange-200",
  FEASIBLE: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  NOT_FEASIBLE: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  APPROVED: "border-sky-300/20 bg-sky-300/10 text-sky-200",
  IN_PROGRESS: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  COMPLETED: "border-slate-300/20 bg-slate-300/10 text-slate-200"
};

type ProposalForm = {
  title: string;
  description: string;
  source: ProposalSource;
};

const emptyForm: ProposalForm = { title: "", description: "", source: "OFFICIAL" };

export function ProposalsBoard() {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProposalStatus | "Todas">("Todas");
  const [source, setSource] = useState<ProposalSource | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ProposalForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProposals() {
      try {
        const response = await fetch("/api/proposals", { cache: "no-store" });
        if (!response.ok) throw new Error("request failed");
        const data = (await response.json()) as { proposals?: ProposalListItem[] };

        if (!cancelled) {
          setProposals(data.proposals ?? []);
          setSelectedId((current) => current || data.proposals?.[0]?.id || "");
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    loadProposals();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProposals = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const matchesQuery =
        !normalized ||
        [proposal.title, proposal.description, proposal.citizen?.zone ?? "", proposal.citizen?.axis ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesStatus = status === "Todas" || proposal.status === status;
      const matchesSource = source === "Todas" || proposal.source === source;

      return matchesQuery && matchesStatus && matchesSource;
    });
  }, [proposals, query, status, source]);

  const selectedProposal = proposals.find((proposal) => proposal.id === selectedId) ?? filteredProposals[0] ?? null;
  const citizenCount = proposals.filter((proposal) => proposal.source === "CITIZEN").length;
  const inReviewCount = proposals.filter((proposal) => proposal.status === "UNDER_REVIEW" || proposal.status === "SUBMITTED").length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload?.error || "No pudimos guardar la propuesta.");

      const created = payload.proposal as ProposalListItem;
      setProposals((current) => [created, ...current]);
      setSelectedId(created.id);
      setForm(emptyForm);
      setIsFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No pudimos guardar la propuesta.");
    } finally {
      setSaving(false);
    }
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
              Cartera oficial de iniciativas urbanas registradas en la base de datos: surgidas de gabinete, areas tecnicas, Concejo o aportes ciudadanos enviados desde la landing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Registradas" value={proposals.length.toString()} icon={Gauge} />
              <MetricCard label="Ciudadanas" value={citizenCount.toString()} icon={Users} />
              <MetricCard label="En revision" value={inReviewCount.toString()} icon={MessageSquare} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Flujo recomendado</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Reunion o area promotora, evaluacion tecnica e informe para gabinete.</p>
              </div>
              <span className="rounded-md bg-sky-400/15 px-3 py-1 text-xs font-black text-sky-200">MVP</span>
            </div>
            <div className="mt-4 grid gap-2">
              {["Definir origen", "Vincular reunion", "Cruzar normativa", "Preparar informe"].map((step, index) => (
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
        <section className="urban-card rounded-lg p-4 lg:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Nueva propuesta</p>
              <h2 className="mt-2 text-2xl font-black text-white">Registro en la base de datos municipal</h2>
            </div>
            <button onClick={() => setIsFormOpen(false)} className="urban-button rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-300" aria-label="Cerrar formulario">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Titulo</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej.: Recuperacion de veredas en Barrio Norte"
                required
                minLength={5}
                className="h-12 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Descripcion</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Problema, ubicacion, solucion propuesta y beneficiarios."
                required
                minLength={10}
                rows={4}
                className="w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/50"
              />
            </label>
            <label className="grid gap-2 sm:max-w-xs">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Origen</span>
              <select
                value={form.source}
                onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as ProposalSource }))}
                className="h-12 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50"
              >
                {(["OFFICIAL", "CABINET", "TECHNICAL_TEAM", "CITIZEN"] as ProposalSource[]).map((option) => (
                  <option key={option} value={option}>
                    {proposalSourceLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            {formError ? <p className="text-sm font-semibold text-amber-200">{formError}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="urban-button inline-flex items-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar propuesta"}
              </button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="urban-button rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="urban-card rounded-lg p-4 lg:p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por titulo, zona o tema..."
                className="h-14 w-full rounded-md border border-white/10 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50"
              />
            </label>
            <SelectFilter
              label="Estado"
              value={status}
              options={statusFilterOptions}
              format={(value) => (value === "Todas" ? "Todas" : proposalStatusLabels[value])}
              onChange={(value) => setStatus(value)}
            />
            <SelectFilter
              label="Origen"
              value={source}
              options={sourceFilterOptions}
              format={(value) => (value === "Todas" ? "Todos" : proposalSourceLabels[value])}
              onChange={(value) => setSource(value)}
            />
            <button
              onClick={() => setIsFormOpen(true)}
              className="urban-button inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 text-sm font-black text-white"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>

          {loadState === "loading" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 p-10 text-sm font-semibold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando propuestas desde la base de datos...
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-8 text-center text-sm leading-6 text-amber-100">
              No pudimos conectar con la base de datos. Reintenta en unos segundos o revisa la configuracion.
            </div>
          ) : null}

          {loadState === "ready" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {filteredProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    selected={selectedProposal?.id === proposal.id}
                    onSelect={() => setSelectedId(proposal.id)}
                  />
                ))}
              </div>

              {filteredProposals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm leading-6 text-slate-400">
                  {proposals.length === 0
                    ? "Todavia no hay propuestas registradas. Crea la primera con el boton Nueva o desde la landing ciudadana."
                    : "No hay propuestas con esos filtros. Proba cambiar la busqueda, el estado o el origen."}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {selectedProposal ? <ProposalDetail proposal={selectedProposal} /> : <EmptyDetail />}
      </section>
    </div>
  );
}

function ProposalCard({ proposal, selected, onSelect }: { proposal: ProposalListItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`urban-lift rounded-lg border p-4 text-left transition ${
        selected ? "border-sky-300/40 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:border-sky-300/25"
      }`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusStyles[proposal.status] ?? "border-white/10 bg-white/[0.05] text-slate-300"}`}>
          {proposalStatusLabels[proposal.status]}
        </span>
        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">{proposalSourceLabels[proposal.source]}</span>
      </div>
      <h3 className="text-base font-black leading-6 text-white">{proposal.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{proposal.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {proposal.citizen ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {proposal.citizen.zone}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5" />
          {proposal.votes}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {proposal.comments}
        </span>
      </div>
    </button>
  );
}

function ProposalDetail({ proposal }: { proposal: ProposalListItem }) {
  const isProject = PROJECT_STATUSES.includes(proposal.status);

  return (
    <aside className="urban-card h-fit rounded-lg p-5">
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusStyles[proposal.status] ?? "border-white/10 bg-white/[0.05] text-slate-300"}`}>
          {proposalStatusLabels[proposal.status]}
        </span>
        <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-slate-300">{proposalSourceLabels[proposal.source]}</span>
      </div>

      <h2 className="text-xl font-black leading-7 text-white">{proposal.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{proposal.description}</p>

      <div className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <DetailBlock label="Origen" value={proposalSourceLabels[proposal.source]} />
        <DetailBlock label="Estado" value={proposalStatusLabels[proposal.status]} />
        <DetailBlock
          label="Registrada"
          value={new Date(proposal.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
        />
        {proposal.citizen ? <DetailBlock label="Vecino/a" value={proposal.citizen.name} /> : null}
        {proposal.citizen ? <DetailBlock label="Zona" value={proposal.citizen.zone} /> : null}
        {proposal.citizen ? <DetailBlock label="Eje detectado" value={proposal.citizen.axis} /> : null}
        {proposal.latitude != null && proposal.longitude != null ? (
          <DetailBlock label="Ubicacion" value={`${proposal.latitude.toFixed(4)}, ${proposal.longitude.toFixed(4)}`} />
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat label="Apoyos" value={proposal.votes.toString()} icon={ThumbsUp} />
        <MiniStat label="Comentarios" value={proposal.comments.toString()} icon={MessageSquare} />
      </div>

      {isProject ? (
        <Link
          href="/proyectos"
          className="urban-button mt-5 inline-flex w-full items-center justify-between rounded-md border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm font-black text-sky-100"
        >
          Ver en cartera de proyectos
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
    </aside>
  );
}

function EmptyDetail() {
  return (
    <aside className="urban-card h-fit rounded-lg p-5">
      <div className="rounded-lg border border-dashed border-white/15 p-8 text-center">
        <CalendarDays className="mx-auto h-6 w-6 text-slate-500" />
        <p className="mt-3 text-sm leading-6 text-slate-400">Selecciona una propuesta para ver el detalle.</p>
      </div>
    </aside>
  );
}

function SelectFilter<T extends string>({
  label,
  value,
  options,
  format,
  onChange
}: {
  label: string;
  value: T;
  options: T[];
  format: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-14 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-300/50"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Gauge }) {
  return (
    <div className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-civic-sky" />
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Gauge }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      <Icon className="mb-1.5 h-4 w-4 text-civic-sky" />
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-200">{value}</p>
    </div>
  );
}
