"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trash2,
  Users
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { MarkdownText } from "@/components/assistant/markdown-text";
import { ALL_TOPICS, isClassified, isOutOfScope } from "@/lib/citizen/contributions";

// Estado derivado del flujo municipal: recibido → en evaluación → aprobado como proyecto.
type AporteState = "Recibido" | "En evaluación" | "Proyecto aprobado";

const PROJECT_STATUSES = ["APPROVED", "IN_PROGRESS", "COMPLETED"];

type CitizenProposal = {
  id: string;
  title: string;
  neighborhood: string;
  author: string;
  status: AporteState;
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
  /** Por qué Migue sugirió ese eje. Vacío si lo puso una persona o si no hubo sugerencia. */
  axisReason: string;
  /** false = sugerencia de Migue sin revisar. */
  axisConfirmed: boolean;
  confidence: string;
  status: string;
  /** null en los aportes anteriores al login obligatorio: no hay a quién escribirle. */
  email: string | null;
  createdAt: string;
  proposal: {
    id: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
  } | null;
};

const statuses: Array<"Todos" | AporteState> = ["Todos", "Recibido", "En evaluación", "Proyecto aprobado"];

function deriveState(contribution: CitizenContribution): AporteState {
  if (contribution.proposal && PROJECT_STATUSES.includes(contribution.proposal.status)) {
    return "Proyecto aprobado";
  }
  if (contribution.status === "UNDER_REVIEW") {
    return "En evaluación";
  }
  return "Recibido";
}

function mapContributionToProposal(contribution: CitizenContribution): CitizenProposal {
  return {
    id: `citizen-${contribution.id}`,
    title: contribution.proposal?.title ?? `${contribution.kind}: ${contribution.zone}`,
    neighborhood: contribution.zone,
    author: contribution.name,
    status: deriveState(contribution),
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
    NEW: "Recibido",
    LINKED_TO_PROPOSAL: "Vinculado a propuesta",
    UNDER_REVIEW: "En evaluación",
    RESOLVED: "Resuelto",
    ARCHIVED: "Archivado"
  };

  return labels[value] ?? value;
}

export function CitizenParticipation() {
  const [status, setStatus] = useState<(typeof statuses)[number]>("Todos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [citizenContributions, setCitizenContributions] = useState<CitizenContribution[]>([]);
  const [isLoadingContributions, setIsLoadingContributions] = useState(true);
  const [contributionsError, setContributionsError] = useState("");
  // Borradores formalizados por Migue, por id de aporte. El vecino escribe con sus
  // palabras y el equipo decide si quiere la version formal; no se guarda nada.
  const [drafts, setDrafts] = useState<Record<string, { text: string; source: string | null }>>({});
  const [draftingId, setDraftingId] = useState("");
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState("");
  /** Aporte cuyo redactor de mensaje está abierto. */
  const [contactingId, setContactingId] = useState("");

  async function removeContribution(contribution: CitizenContribution) {
    const confirmed = window.confirm(
      `Vas a eliminar definitivamente este ${contribution.kind.toLowerCase()} de ${contribution.name} y la propuesta vinculada.\n\n"${contribution.text.slice(0, 120)}${contribution.text.length > 120 ? "..." : ""}"\n\nNo hay papelera: esto no se puede deshacer. ¿Confirmás?`
    );

    if (!confirmed || deletingId) {
      return;
    }

    setDeletingId(contribution.id);

    try {
      const response = await fetch(`/api/citizen-contributions/${contribution.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos eliminar el aporte.");
      }

      setCitizenContributions((current) => current.filter((item) => item.id !== contribution.id));
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "No pudimos eliminar el aporte.");
    } finally {
      setDeletingId("");
    }
  }

  async function assignAxis(contribution: CitizenContribution, axis: string) {
    const previousAxis = contribution.axis;
    const previousConfirmed = contribution.axisConfirmed;

    // Optimista: el select responde al toque y se revierte si el server rechaza.
    setCitizenContributions((current) =>
      current.map((item) => (item.id === contribution.id ? { ...item, axis, axisConfirmed: true } : item))
    );

    try {
      const response = await fetch(`/api/citizen-contributions/${contribution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ axis })
      });

      if (!response.ok) {
        throw new Error("No pudimos guardar el eje.");
      }
    } catch {
      setCitizenContributions((current) =>
        current.map((item) =>
          item.id === contribution.id ? { ...item, axis: previousAxis, axisConfirmed: previousConfirmed } : item
        )
      );
    }
  }

  async function formalizeContribution(contribution: CitizenContribution) {
    if (draftingId) {
      return;
    }

    setDraftingId(contribution.id);
    setDraftErrors((current) => ({ ...current, [contribution.id]: "" }));

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Formalizá este aporte ciudadano como texto listo para presentar, fundamentado en el Codigo de Planeamiento Urbano.",
          // El relato del vecino viaja como historial: es la materia prima que Migue
          // tiene que elevar, igual que cuando lo cuenta en el chat.
          history: [
            {
              role: "user",
              content: `${contribution.kind} en ${contribution.zone}. Eje detectado: ${contribution.axis}. El vecino cuenta: ${contribution.text}`
            }
          ],
          assistantContext: {
            module: "propuestas",
            page: "Participacion ciudadana",
            intent: "formalizar aporte ciudadano"
          }
        })
      });
      const payload = (await response.json()) as { answer?: string; detail?: string; error?: string; source?: { reference?: string } | null };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.detail ?? payload.error ?? "No pudimos formalizar el aporte.");
      }

      setDrafts((current) => ({
        ...current,
        [contribution.id]: { text: payload.answer as string, source: payload.source?.reference ?? null }
      }));
    } catch (error) {
      setDraftErrors((current) => ({
        ...current,
        [contribution.id]: error instanceof Error ? error.message : "No pudimos formalizar el aporte."
      }));
    } finally {
      setDraftingId("");
    }
  }

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
      const matchesStatus = status === "Todos" || proposal.status === status;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        proposal.title.toLowerCase().includes(normalizedQuery) ||
        proposal.neighborhood.toLowerCase().includes(normalizedQuery) ||
        proposal.area.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [contributionProposals, query, status]);

  const selectedProposal = visibleProposals.find((proposal) => proposal.id === selectedId) ?? visibleProposals[0] ?? null;
  const selectedContribution = selectedProposal
    ? citizenContributions.find((contribution) => `citizen-${contribution.id}` === selectedProposal.id) ?? null
    : null;
  const selectedState = selectedContribution ? deriveState(selectedContribution) : null;
  const [workingAction, setWorkingAction] = useState<"review" | "approve" | null>(null);
  const [workflowError, setWorkflowError] = useState("");

  async function sendToReview() {
    if (!selectedContribution || selectedState !== "Recibido" || workingAction) {
      return;
    }
    setWorkingAction("review");
    setWorkflowError("");
    try {
      const response = await fetch(`/api/citizen-contributions/${selectedContribution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UNDER_REVIEW" })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos enviar el aporte a evaluación.");
      }
      setCitizenContributions((current) =>
        current.map((contribution) =>
          contribution.id === selectedContribution.id ? { ...contribution, status: "UNDER_REVIEW" } : contribution
        )
      );
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "No pudimos enviar el aporte a evaluación.");
    } finally {
      setWorkingAction(null);
    }
  }

  async function approveAsProject() {
    const proposal = selectedContribution?.proposal;
    if (!selectedContribution || !proposal || selectedState === "Proyecto aprobado" || workingAction) {
      return;
    }
    setWorkingAction("approve");
    setWorkflowError("");
    try {
      const response = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos aprobar el proyecto.");
      }
      setCitizenContributions((current) =>
        current.map((contribution) =>
          contribution.id === selectedContribution.id && contribution.proposal
            ? { ...contribution, proposal: { ...contribution.proposal, status: "APPROVED" } }
            : contribution
        )
      );
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "No pudimos aprobar el proyecto.");
    } finally {
      setWorkingAction(null);
    }
  }

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
            <div className="mt-6">
              <Link
                href="/#participacion"
                className="urban-button inline-flex items-center gap-2 rounded-md border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm font-bold text-sky-100"
              >
                Los vecinos participan desde el portal público
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Aportes recibidos", citizenContributions.length.toString()],
              ["En evaluación", citizenContributions.filter((contribution) => deriveState(contribution) === "En evaluación").length.toString()],
              ["Aprobados como proyecto", citizenContributions.filter((contribution) => deriveState(contribution) === "Proyecto aprobado").length.toString()]
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
                  {!isClassified(contribution.axis) ? (
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-slate-400">Sin clasificar</span>
                  ) : isOutOfScope(contribution.axis) ? (
                    // Ambar y no verde: el CPU no lo regula, se resuelve por otra via.
                    <span
                      className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-100"
                      title="El Codigo de Planeamiento no regula este tema"
                    >
                      {contribution.axis}
                    </span>
                  ) : (
                    <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-black text-emerald-100">{contribution.axis}</span>
                  )}
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
                  <label className="block rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Eje urbano {isClassified(contribution.axis) && !contribution.axisConfirmed ? "· sugerido" : ""}
                    </span>
                    <select
                      value={isClassified(contribution.axis) ? contribution.axis : ""}
                      onChange={(event) => assignAxis(contribution, event.target.value)}
                      className="mt-2 h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-2 text-sm font-bold text-white outline-none focus:border-sky-400/50"
                    >
                      <option value="" disabled>
                        Asignar eje...
                      </option>
                      {ALL_TOPICS.map((topic) => (
                        <option key={topic.id} value={topic.label} title={topic.summary}>
                          {topic.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* El porqué de la sugerencia: sin esto, "Migue dice Edificacion" es
                    otra caja negra en la que hay que confiar a ciegas. */}
                {contribution.axisReason && !contribution.axisConfirmed ? (
                  <div className="mt-3 rounded-md border border-sky-300/15 bg-sky-300/[0.05] p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">
                      <Sparkles className="h-3 w-3" />
                      Migue sugiere este eje
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-300">{contribution.axisReason}</p>
                    <button
                      type="button"
                      onClick={() => assignAxis(contribution, contribution.axis)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1.5 text-[11px] font-black text-emerald-100 transition hover:bg-emerald-300/20"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmar eje
                    </button>
                  </div>
                ) : null}
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => formalizeContribution(contribution)}
                    disabled={Boolean(draftingId)}
                    className="inline-flex items-center gap-2 rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-black text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {draftingId === contribution.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {draftingId === contribution.id
                      ? "Formalizando..."
                      : drafts[contribution.id]
                        ? "Volver a formalizar"
                        : "Formalizar con Migue"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setContactingId(contactingId === contribution.id ? "" : contribution.id)}
                    disabled={!contribution.email}
                    title={
                      contribution.email
                        ? `Escribirle a ${contribution.email}`
                        : "Este aporte se cargo antes del login obligatorio: no tiene cuenta asociada, asi que no hay email"
                    }
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Contactar al vecino
                  </button>

                  <button
                    type="button"
                    onClick={() => removeContribution(contribution)}
                    disabled={Boolean(deletingId)}
                    className="inline-flex items-center gap-2 rounded-md border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === contribution.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Eliminar
                  </button>
                </div>

                {contactingId === contribution.id && contribution.email ? (
                  <ContactComposer contribution={contribution} onClose={() => setContactingId("")} />
                ) : null}

                {draftErrors[contribution.id] ? (
                  <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
                    {draftErrors[contribution.id]}
                  </p>
                ) : null}

                {drafts[contribution.id] ? (
                  <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">Borrador formalizado</p>
                      {drafts[contribution.id].source ? (
                        <span className="rounded border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                          Fuente: {drafts[contribution.id].source}
                        </span>
                      ) : null}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <MarkdownText text={drafts[contribution.id].text} compact tone="dark" />
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">
                      Sugerencia de Migue sobre el relato del vecino. No se guarda ni reemplaza el texto original.
                    </p>
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
                ["Barrio", selectedProposal?.neighborhood ?? "-"],
                ["Eje", selectedProposal?.area ?? "-"],
                ["Recibido el", selectedContribution ? formatContributionDate(selectedContribution.createdAt) : "-"],
                ["Estado", selectedState ?? "-"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
                </div>
              ))}
            </div>

            {selectedState === "Proyecto aprobado" && selectedContribution?.proposal ? (
              <Link
                href={`/proyectos/${selectedContribution.proposal.id}`}
                className="urban-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100"
              >
                <CheckCircle2 className="h-4 w-4" />
                Ver proyecto aprobado
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-5 grid gap-2">
                <button
                  onClick={sendToReview}
                  disabled={!selectedContribution || selectedState !== "Recibido" || workingAction !== null}
                  className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-civic-blue px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {workingAction === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {selectedState === "En evaluación" ? "En evaluación" : "Enviar a evaluación"}
                </button>
                <button
                  onClick={approveAsProject}
                  disabled={!selectedContribution?.proposal || workingAction !== null}
                  className="urban-button inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {workingAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Aprobar como proyecto
                </button>
              </div>
            )}
            {workflowError ? <p className="mt-3 text-xs font-bold leading-5 text-amber-200">{workflowError}</p> : null}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

/** Plantillas de arranque. El texto se edita a mano: son un punto de partida, no un envío automático. */
const CONTACT_TEMPLATES = [
  {
    id: "devolucion",
    label: "Devolucion",
    subject: (c: CitizenContribution) => `Tu ${c.kind.toLowerCase()} sobre ${c.zone} - Municipalidad de San Miguel de Tucuman`,
    body: (c: CitizenContribution) =>
      [
        `Estimado/a ${c.name}:`,
        "",
        `Nos comunicamos desde la Municipalidad de San Miguel de Tucuman en relacion al ${c.kind.toLowerCase()} que presentaste sobre ${c.zone}.`,
        "",
        "[Escribi aca la devolucion: en que estado esta, que se reviso y cuales son los proximos pasos.]",
        "",
        "Gracias por participar en la construccion de la ciudad.",
        "",
        "Atentamente,",
        "[Tu nombre y area]",
        "Municipalidad de San Miguel de Tucuman"
      ].join("\n")
  },
  {
    id: "citacion",
    label: "Citacion",
    subject: (c: CitizenContribution) => `Citacion - Expediente vinculado a ${c.zone}`,
    body: (c: CitizenContribution) =>
      [
        `Estimado/a ${c.name}:`,
        "",
        `Por medio de la presente se lo/a cita a comparecer ante la Municipalidad de San Miguel de Tucuman en relacion a la situacion detectada en ${c.zone}.`,
        "",
        "[Detalla aca: normativa presuntamente infringida, articulo, fecha y hora de la citacion, dependencia y documentacion a presentar.]",
        "",
        "La presente citacion se enmarca en las facultades de contralor del municipio. Ante cualquier duda podes responder a este correo.",
        "",
        "Atentamente,",
        "[Tu nombre y area]",
        "Municipalidad de San Miguel de Tucuman"
      ].join("\n")
  }
];

/**
 * Redactor de mensaje al vecino. NO envía nada: arma el texto y abre Gmail (o el
 * cliente de correo) con todo cargado para que la persona lo revise y lo mande.
 * El municipio se hace responsable de lo que firma; el sistema solo evita el
 * copiar y pegar.
 */
function ContactComposer({ contribution, onClose }: { contribution: CitizenContribution; onClose: () => void }) {
  const [templateId, setTemplateId] = useState(CONTACT_TEMPLATES[0].id);
  const template = CONTACT_TEMPLATES.find((item) => item.id === templateId) ?? CONTACT_TEMPLATES[0];
  const [subject, setSubject] = useState(() => template.subject(contribution));
  const [body, setBody] = useState(() => template.body(contribution));

  function applyTemplate(id: string) {
    const next = CONTACT_TEMPLATES.find((item) => item.id === id) ?? CONTACT_TEMPLATES[0];
    setTemplateId(id);
    setSubject(next.subject(contribution));
    setBody(next.body(contribution));
  }

  const email = contribution.email ?? "";
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mt-3 rounded-md border border-white/10 bg-slate-950/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
          <Mail className="h-3 w-3" />
          Para {email}
        </p>
        <button onClick={onClose} className="text-[11px] font-bold text-slate-500 hover:text-slate-300">
          Cerrar
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {CONTACT_TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyTemplate(item.id)}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-black transition ${
              templateId === item.id
                ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Asunto</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-2.5 text-sm text-white outline-none focus:border-sky-400/50"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Mensaje</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={10}
          className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950/70 p-2.5 text-sm leading-6 text-slate-200 outline-none focus:border-sky-400/50"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-[#1f89f6] px-3 py-2 text-xs font-black text-white transition hover:bg-[#087bec]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Abrir en Gmail
        </a>
        <a
          href={mailtoUrl}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Mail className="h-3.5 w-3.5" />
          Abrir en mi correo
        </a>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        El sistema no envia el correo: se abre con el texto cargado para que lo revises y lo mandes vos.
      </p>
    </div>
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
