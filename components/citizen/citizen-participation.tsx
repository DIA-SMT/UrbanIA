"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  MessageSquare,
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

const proposals: CitizenProposal[] = [
  {
    id: "iluminacion-barrio-sur",
    title: "Mejorar iluminacion en Barrio Sur",
    neighborhood: "Barrio Sur",
    author: "Maria B.",
    status: "Recientes",
    votes: 124,
    comments: 24,
    area: "Seguridad urbana",
    summary: "Pedido para reforzar luminarias peatonales en esquinas de alta circulacion nocturna."
  },
  {
    id: "plaza-belgrano-peru",
    title: "Plaza en Av. Belgrano y Peru",
    neighborhood: "Oeste",
    author: "Juan P.",
    status: "En evaluacion",
    votes: 88,
    comments: 18,
    area: "Espacios verdes",
    summary: "Transformar un lote subutilizado en espacio publico con sombra, bancos y juegos."
  },
  {
    id: "bicisendas-centro",
    title: "Mas bicisendas en el centro",
    neighborhood: "Centro",
    author: "Lucia G.",
    status: "Populares",
    votes: 236,
    comments: 35,
    area: "Movilidad",
    summary: "Conectar corredores existentes para viajes cortos y acceso seguro a edificios publicos."
  },
  {
    id: "parque-rio-sali",
    title: "Parque lineal en Rio Sali",
    neighborhood: "Este",
    author: "Carlos M.",
    status: "Populares",
    votes: 310,
    comments: 42,
    area: "Ambiente",
    summary: "Recuperacion paisajistica y ambiental de borde ribereno con recorridos peatonales."
  }
];

const comments = [
  { author: "Sofia R.", text: "Seria clave sumar arbolado y bancos, no solo pavimento.", proposal: "Plaza en Av. Belgrano y Peru" },
  { author: "Miguel A.", text: "La zona necesita mas iluminacion en las paradas de colectivo.", proposal: "Mejorar iluminacion en Barrio Sur" },
  { author: "Valentina C.", text: "Las bicisendas deberian conectarse con escuelas y facultades.", proposal: "Mas bicisendas en el centro" }
];

const agenda = [
  { date: "28 Jun", title: "Consulta por movilidad centro", type: "Abierta" },
  { date: "04 Jul", title: "Mesa barrial Barrio Sur", type: "Presencial" },
  { date: "11 Jul", title: "Espacios verdes y arbolado", type: "Online" }
];

const statuses: Array<"Todas" | ProposalStatus> = ["Todas", "Recientes", "Populares", "En evaluacion"];

export function CitizenParticipation() {
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todas");
  const [query, setQuery] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<CitizenProposal>(proposals[0]);

  const visibleProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const matchesStatus = status === "Todas" || proposal.status === status;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        proposal.title.toLowerCase().includes(normalizedQuery) ||
        proposal.neighborhood.toLowerCase().includes(normalizedQuery) ||
        proposal.area.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, status]);

  return (
    <AppShell>
      <section className="urban-card urban-lift overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
          <div>
            <div className="urban-pulse mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              <Users className="h-4 w-4" />
              Ciudadania activa
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">Participacion ciudadana</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Espacio para registrar propuestas, priorizar ideas, reunir comentarios y alimentar decisiones urbanas con trazabilidad publica.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="urban-button inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-civic-ink">
                <Plus className="h-4 w-4" />
                Nueva propuesta
              </button>
              <button className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200">
                <Vote className="h-4 w-4" />
                Abrir votacion
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Participantes", "1.240"],
              ["Comentarios", "386"],
              ["Propuestas", "128"]
            ].map(([label, value]) => (
              <div key={label} className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
                <p className="text-2xl font-black text-civic-mint">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="urban-card rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="urban-lift flex min-w-64 flex-1 items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-400">
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
                      status === item ? "bg-emerald-400/18 text-emerald-100" : "bg-white/[0.04] text-slate-400"
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
                onClick={() => setSelectedProposal(proposal)}
                className={`urban-card urban-lift min-w-0 rounded-lg p-5 text-left ${
                  selectedProposal.id === proposal.id ? "border-emerald-300/40" : ""
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-md bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">{proposal.area}</span>
                    <h2 className="mt-3 text-lg font-black leading-tight text-white">{proposal.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-200">{proposal.status}</span>
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
        </div>

        <aside className="space-y-4">
          <div className="urban-card urban-lift rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-400/15 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">Ficha seleccionada</h2>
                <p className="text-xs text-slate-500">Trazabilidad inicial</p>
              </div>
            </div>
            <h3 className="text-xl font-black leading-tight text-white">{selectedProposal.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{selectedProposal.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Apoyos", selectedProposal.votes.toString()],
                ["Comentarios", selectedProposal.comments.toString()],
                ["Barrio", selectedProposal.neighborhood],
                ["Estado", selectedProposal.status]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
                </div>
              ))}
            </div>
            <button className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-black text-civic-ink">
              <CheckCircle2 className="h-4 w-4" />
              Enviar a evaluacion
            </button>
          </div>

          <div className="urban-card rounded-lg p-5">
            <h2 className="mb-4 font-bold text-white">Comentarios recientes</h2>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={`${comment.author}-${comment.proposal}`} className="urban-lift rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-sm leading-6 text-slate-300">"{comment.text}"</p>
                  <p className="mt-2 text-xs text-slate-500">{comment.author} - {comment.proposal}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="urban-card rounded-lg p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              Agenda de consultas
            </h2>
            <div className="space-y-3">
              {agenda.map((item) => (
                <div key={item.title} className="urban-lift flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <div className="rounded-md bg-cyan-400/15 px-3 py-2 text-xs font-black text-cyan-100">{item.date}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
