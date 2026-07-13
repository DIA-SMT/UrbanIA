"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  ThumbsUp,
  Users,
  Vote
} from "lucide-react";
import { AppShell } from "@/components/shell";

type ProposalStatus = "Recientes" | "Populares" | "En evaluacion";

type CitizenProposal = {
  id: string;
  title: string;
  neighborhood: string;
  author: string;
  status: ProposalStatus;
  votes: number;
  comments: number;
  summary: string;
  area: string;
};

type CitizenContribution = {
  id: string;
  kind: "Propuesta" | "Reclamo" | "Aporte";
  name: string;
  dni: string;
  zone: string;
  text: string;
  fileName: string;
  axis: string;
  confidence: string;
  status: string;
  createdAt: string;
  proposal: {
    id: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
  } | null;
};

const statuses: Array<"Todas" | ProposalStatus> = ["Todas", "Recientes", "Populares", "En evaluacion"];

function mapContributionToProposal(contribution: CitizenContribution): CitizenProposal {
  return {
    id: `citizen-${contribution.id}`,
    title: contribution.proposal?.title ?? `${contribution.kind}: ${contribution.zone}`,
    neighborhood: contribution.zone,
    author: contribution.name,
    status: contribution.status === "LINKED_TO_PROPOSAL" ? "En evaluacion" : "Recientes",
    votes: 0,
    comments: 1,
    area: contribution.axis,
    summary: contribution.text
  };
}

function formatContributionDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatContributionStatus(value: string) {
  const labels: Record<string, string> = {
    RECEIVED: "Recibido",
    LINKED_TO_PROPOSAL: "Vinculado a propuesta",
    DISMISSED: "Archivado"
  };

  return labels[value] ?? value;
}

export function CitizenParticipation() {
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todas");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [citizenContributions, setCitizenContributions] = useState<CitizenContribution[]>([]);
  const [isLoadingContributions, setIsLoadingContributions] = useState(true);
  const [contributionsError, setContributionsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadContributions() {
      try {
        const response = await fetch("/api/citizen-contributions", { cache: "no-store" });
        const data = (await response.json()) as { contributions?: CitizenContribution[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "No pudimos cargar los aportes ciudadanos.");
        }

        if (isMounted) {
          const nextContributions = data.contributions ?? [];
          setCitizenContributions(nextContributions);
          setSelectedId(nextContributions[0]?.id ? `citizen-${nextContributions[0].id}` : "");
          setContributionsError("");
        }
      } catch (error) {
        if (isMounted) {
          setCitizenContributions([]);
          setSelectedId("");
          setContributionsError(error instanceof Error ? error.message : "No pudimos cargar los aportes ciudadanos.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingContributions(false);
        }
      }
    }

    loadContributions();

    return () => {
      isMounted = false;
    };
  }, []);

  const contributionProposals = useMemo(
    () => citizenContributions.map(mapContributionToProposal),
    [citizenContributions]
  );

  const visibleProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return contributionProposals.filter((proposal) => {
      const matchesStatus = status === "Todas" || proposal.status === status;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        proposal.title.toLowerCase().includes(normalizedQuery) ||
        proposal.neighborhood.toLowerCase().includes(normalizedQuery) ||
        proposal.area.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [contributionProposals, query, status]);

  const selectedProposal = visibleProposals.find((proposal) => proposal.id === selectedId) ?? visibleProposals[0] ?? null;

  return (
    <AppShell>
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
          <div>
            <div className="urban-pulse mb-4 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-sky-200">
              <Users className="h-4 w-4" />
              Ciudadania activa
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">Participacion ciudadana</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Espacio para registrar propuestas, priorizar ideas, reunir comentarios y alimentar decisiones urbanas con trazabilidad publica.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <button className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-bold text-white sm:w-auto">
                <Plus className="h-4 w-4" />
                Nueva propuesta
              </button>
              <button className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 sm:w-auto">
                <Vote className="h-4 w-4" />
                Abrir votacion
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Participantes", citizenContributions.length.toString()],
              ["Comentarios", "0"],
              ["Aportes ciudadanos", citizenContributions.length.toString()]
            ].map(([label, value]) => (
              <div key={label} className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
                <p className="text-2xl font-black text-civic-sky">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 urban-card rounded-lg p-4 lg:p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
              <FileText className="h-4 w-4" />
              Aportes ciudadanos
            </div>
            <h2 className="text-2xl font-black leading-tight text-white">Aportes ciudadanos recibidos</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Cada aporte queda organizado con texto original, eje detectado, estado de vinculacion y propuesta interna creada para revision municipal.
            </p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300">
            {isLoadingContributions ? "Cargando..." : `${citizenContributions.length} aportes`}
          </span>
        </div>

        {contributionsError ? (
          <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
            {contributionsError}
          </div>
        ) : null}

        {citizenContributions.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {citizenContributions.map((contribution) => (
              <article key={contribution.id} className="urban-lift rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-xs font-black text-sky-100">{contribution.kind}</span>
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-black text-emerald-100">{contribution.axis}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-400">{formatContributionDate(contribution.createdAt)}</span>
                </div>
                <h3 className="text-lg font-black leading-tight text-white">
                  {contribution.proposal?.title ?? `${contribution.kind}: ${contribution.zone}`}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {contribution.zone} - {contribution.name} - DNI {contribution.dni}
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{contribution.text}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoTile label="Estado interno" value={formatContributionStatus(contribution.status)} />
                  <InfoTile label="Confianza IA" value={contribution.confidence} />
                </div>
                {contribution.fileName ? (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
                    <Paperclip className="h-4 w-4 text-sky-300" />
                    {contribution.fileName}
                  </p>
                ) : null}
                {contribution.proposal ? (
                  <div className="mt-4 rounded-md border border-sky-300/15 bg-sky-300/[0.05] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">Propuesta vinculada</p>
                    <p className="mt-1 text-sm font-bold text-white">{contribution.proposal.title}</p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{contribution.proposal.description}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm leading-6 text-slate-400">
            Todavia no hay aportes enviados desde la landing. Cuando un vecino complete el formulario publico, aparecera aca con su detalle completo.
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="urban-card rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="urban-lift flex min-w-0 flex-1 basis-full items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-400 md:basis-64">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por barrio, tema o propuesta..."
                  className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {statuses.map((item) => (
                  <button
                    key={item}
                    onClick={() => setStatus(item)}
                    className={`urban-button rounded-md px-3 py-2 text-xs font-bold ${
                      status === item ? "bg-sky-400/18 text-sky-100" : "bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {visibleProposals.map((proposal) => (
              <button
                key={proposal.id}
                onClick={() => setSelectedId(proposal.id)}
                className={`urban-card urban-lift min-w-0 rounded-lg p-5 text-left ${
                  selectedProposal?.id === proposal.id ? "border-sky-300/40" : ""
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-md bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">{proposal.area}</span>
                    <h2 className="mt-3 text-lg font-black leading-tight text-white">{proposal.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-md bg-sky-400/15 px-2 py-1 text-xs font-bold text-sky-200">{proposal.status}</span>
                </div>
                <p className="text-sm leading-6 text-slate-400">{proposal.summary}</p>
                <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>{proposal.neighborhood} - {proposal.author}</span>
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> {proposal.votes}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {proposal.comments}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {!isLoadingContributions && visibleProposals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm leading-6 text-slate-400">
              No hay aportes ciudadanos reales para mostrar con esos filtros.
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="urban-card urban-lift rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-sky-400/15 text-sky-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">Ficha seleccionada</h2>
                <p className="text-xs text-slate-500">Trazabilidad inicial</p>
              </div>
            </div>
            <h3 className="text-xl font-black leading-tight text-white">{selectedProposal?.title ?? "Sin aporte seleccionado"}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{selectedProposal?.summary ?? "Selecciona un aporte ciudadano real para revisar su trazabilidad inicial."}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {[
                ["Apoyos", selectedProposal?.votes.toString() ?? "0"],
                ["Comentarios", selectedProposal?.comments.toString() ?? "0"],
                ["Barrio", selectedProposal?.neighborhood ?? "-"],
                ["Estado", selectedProposal?.status ?? "-"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
                </div>
              ))}
            </div>
            <button className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white">
              <CheckCircle2 className="h-4 w-4" />
              Enviar a evaluacion
            </button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}
