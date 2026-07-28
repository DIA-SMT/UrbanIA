"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Rows3,
  Search,
  Sparkles,
  Trash2,
  Users
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { MarkdownText } from "@/components/assistant/markdown-text";
import { ALL_TOPICS, isClassified, isOutOfScope, UNCLASSIFIED_AXIS } from "@/lib/citizen/contributions";

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

// Color por tipo de aporte, para el riel lateral y el badge. Distingue de un
// vistazo propuesta / reclamo / aporte sin leer.
const KIND_META: Record<string, { rail: string; badge: string; icon: typeof Sparkles }> = {
  Propuesta: { rail: "#60a5fa", badge: "bg-blue-400/15 text-blue-100", icon: Sparkles },
  Reclamo: { rail: "#fb7185", badge: "bg-rose-400/15 text-rose-100", icon: AlertTriangle },
  Aporte: { rail: "#22d3ee", badge: "bg-cyan-400/15 text-cyan-100", icon: MessageSquare }
};

// Orden de los grupos en la vista "Por eje": primero lo que el CPU sí regula,
// después lo sin clasificar, y "Fuera del alcance del CPU" al final. Sin esto,
// el bucket dominante (fuera de alcance) tapa lo accionable.
const IN_SCOPE_AXES = ALL_TOPICS.filter((topic) => !isOutOfScope(topic.label)).map((topic) => topic.label);
const OUT_SCOPE_AXES = ALL_TOPICS.filter((topic) => isOutOfScope(topic.label)).map((topic) => topic.label);
const AXIS_GROUP_ORDER = [...IN_SCOPE_AXES, UNCLASSIFIED_AXIS, ...OUT_SCOPE_AXES];

// El eje quedó sugerido por Migue pero nadie lo confirmó: espera decisión humana.
function aporteNeedsReview(contribution: CitizenContribution) {
  return isClassified(contribution.axis) && !contribution.axisConfirmed;
}

function contributionAxisKey(contribution: CitizenContribution) {
  return isClassified(contribution.axis) ? contribution.axis : UNCLASSIFIED_AXIS;
}

function axisScope(axis: string): "in" | "out" | "none" {
  if (axis === UNCLASSIFIED_AXIS || !isClassified(axis)) return "none";
  return isOutOfScope(axis) ? "out" : "in";
}

export function CitizenParticipation() {
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
  // Organización de la lista de aportes recibidos (triage municipal).
  const [aporteQuery, setAporteQuery] = useState("");
  const [aporteKind, setAporteKind] = useState<"all" | "Propuesta" | "Reclamo" | "Aporte">("all");
  const [aporteAxis, setAporteAxis] = useState("all");
  const [aporteSoloRevisar, setAporteSoloRevisar] = useState(false);
  const [aporteSort, setAporteSort] = useState<"recientes" | "revisar">("recientes");
  const [aporteView, setAporteView] = useState<"lista" | "eje">("lista");
  const [expandedAportes, setExpandedAportes] = useState<Set<string>>(new Set());

  function toggleAporte(id: string) {
    setExpandedAportes((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function removeContribution(contribution: CitizenContribution) {
    const confirmed = window.confirm(
      `Vas a eliminar definitivamente este ${contribution.kind.toLowerCase()} de ${contribution.name} y la propuesta vinculada.\n\n"${contribution.text.slice(0, 120)}${contribution.text.length > 120 ? "..." : ""}"\n\nNo hay papelera: esto no se puede deshacer. ¿Confirmás?`
    );

    if (!confirmed || deletingId) {
      return;
    }

    setDeletingId(contribution.id);

    try {
      const response = await fetch(`/api/citizen-contributions?id=${contribution.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos eliminar el aporte.");
      }

      setCitizenContributions((current) => current.filter((item) => item.id !== contribution.id));
    } catch (error) {
      setDraftErrors((prev) => ({
        ...prev,
        [contribution.id]: error instanceof Error ? error.message : "No pudimos eliminar el aporte."
      }));
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
      const response = await fetch(`/api/citizen-contributions?id=${contribution.id}`, {
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
      const response = await fetch("/api/assistant?action=query", {
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
          setCitizenContributions(data.contributions ?? []);
          setContributionsError("");
        }
      } catch (error) {
        if (isMounted) {
          setCitizenContributions([]);
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

  // Aportes recibidos, filtrados y ordenados para el triage municipal.
  const visibleContributions = useMemo(() => {
    const normalized = aporteQuery.trim().toLowerCase();
    const list = citizenContributions.filter((contribution) => {
      if (aporteKind !== "all" && contribution.kind !== aporteKind) return false;
      if (aporteAxis !== "all" && contributionAxisKey(contribution) !== aporteAxis) return false;
      if (aporteSoloRevisar && !aporteNeedsReview(contribution)) return false;
      if (normalized.length) {
        const haystack = `${contribution.kind} ${contribution.zone} ${contribution.name} ${contribution.text}`.toLowerCase();
        if (!haystack.includes(normalized)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (aporteSort === "revisar") {
        const diff = Number(aporteNeedsReview(b)) - Number(aporteNeedsReview(a));
        if (diff !== 0) return diff;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [citizenContributions, aporteQuery, aporteKind, aporteAxis, aporteSoloRevisar, aporteSort]);

  const contributionStats = useMemo(() => {
    const byAxis: Record<string, number> = {};
    let review = 0;
    let outOfScope = 0;
    for (const contribution of citizenContributions) {
      const key = contributionAxisKey(contribution);
      byAxis[key] = (byAxis[key] ?? 0) + 1;
      if (aporteNeedsReview(contribution)) review += 1;
      if (axisScope(contribution.axis) === "out") outOfScope += 1;
    }
    return { total: citizenContributions.length, review, outOfScope, byAxis };
  }, [citizenContributions]);

  // Vista "Por eje": grupos no vacíos en el orden definido (CPU primero, fuera al final).
  const contributionGroups = useMemo(
    () =>
      AXIS_GROUP_ORDER.map((axis) => ({
        axis,
        items: visibleContributions.filter((contribution) => contributionAxisKey(contribution) === axis)
      })).filter((group) => group.items.length > 0),
    [visibleContributions]
  );

  // Lista plana para un solo .map: en vista "Por eje" intercala encabezados de grupo.
  type ContributionRow =
    | { type: "header"; axis: string; count: number }
    | { type: "row"; contribution: CitizenContribution };
  const contributionRows = useMemo<ContributionRow[]>(() => {
    if (aporteView === "eje") {
      const rows: ContributionRow[] = [];
      for (const group of contributionGroups) {
        rows.push({ type: "header", axis: group.axis, count: group.items.length });
        for (const contribution of group.items) rows.push({ type: "row", contribution });
      }
      return rows;
    }
    return visibleContributions.map((contribution) => ({ type: "row", contribution }));
  }, [aporteView, contributionGroups, visibleContributions]);

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

          <div className="grid gap-3">
            <div className="urban-lift rounded-md border border-white/10 bg-slate-950/50 p-4">
              <p className="text-2xl font-black text-civic-sky">{citizenContributions.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Aportes recibidos</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 urban-card rounded-lg p-4 lg:p-5">
        <div className="mb-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
            <FileText className="h-4 w-4" />
            Aportes ciudadanos
          </div>
          <h2 className="text-2xl font-black leading-tight text-white">Aportes ciudadanos recibidos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Lo que los vecinos presentan desde el portal. Priorizá lo que necesita revisión, filtrá por eje o tipo, y abrí cada aporte solo cuando lo trabajes.
          </p>
        </div>

        {isLoadingContributions ? null : (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard value={contributionStats.total} label="Aportes" tone="sky" />
            <StatCard value={contributionStats.review} label="Eje por revisar" tone="amber" />
            <StatCard value={contributionStats.outOfScope} label="Fuera del CPU" tone="slate" />
          </div>
        )}

        {contributionsError ? (
          <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
            {contributionsError}
          </div>
        ) : null}

        {citizenContributions.length ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={aporteQuery}
                  onChange={(event) => setAporteQuery(event.target.value)}
                  placeholder="Buscar por texto, zona o vecino..."
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/50 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
                />
              </label>
              <div className="inline-flex rounded-lg border border-white/10 bg-slate-950/50 p-1">
                {(["lista", "eje"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setAporteView(view)}
                    aria-pressed={aporteView === view}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-black transition ${
                      aporteView === view ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {view === "lista" ? <List className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                    {view === "lista" ? "Lista" : "Por eje"}
                  </button>
                ))}
              </div>
              <select
                value={aporteSort}
                onChange={(event) => setAporteSort(event.target.value as "recientes" | "revisar")}
                className="h-10 rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs font-bold text-white outline-none focus:border-sky-400/50"
              >
                <option value="recientes">Más recientes</option>
                <option value="revisar">Por revisar primero</option>
              </select>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(["all", "Propuesta", "Reclamo", "Aporte"] as const).map((kind) => (
                <FilterChip key={kind} active={aporteKind === kind} onClick={() => setAporteKind(kind)}>
                  {kind === "all" ? "Todos" : kind === "Propuesta" ? "Propuestas" : kind === "Reclamo" ? "Reclamos" : "Aportes"}
                </FilterChip>
              ))}
              <button
                type="button"
                onClick={() => setAporteSoloRevisar((value) => !value)}
                aria-pressed={aporteSoloRevisar}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${
                  aporteSoloRevisar
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Solo por revisar
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
              <FilterChip active={aporteAxis === "all"} onClick={() => setAporteAxis("all")}>
                Todos los ejes
              </FilterChip>
              {AXIS_GROUP_ORDER.filter((axis) => contributionStats.byAxis[axis]).map((axis) => (
                <FilterChip key={axis} active={aporteAxis === axis} onClick={() => setAporteAxis(axis)}>
                  {axis}
                  <span className="ml-1.5 tabular-nums opacity-60">{contributionStats.byAxis[axis]}</span>
                </FilterChip>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {contributionRows.map((item) => {
                if (item.type === "header") {
                  const scope = axisScope(item.axis);
                  const dot = scope === "in" ? "#34d399" : scope === "out" ? "#fbbf24" : "#64748b";
                  return (
                    <div key={`grupo-${item.axis}`} className="flex items-center gap-2.5 pt-3 first:pt-0">
                      <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />
                      <span className="text-xs font-black tracking-wide text-slate-200">{item.axis}</span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-400">{item.count}</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  );
                }

                const contribution = item.contribution;
                const expanded = expandedAportes.has(contribution.id);
                const meta = KIND_META[contribution.kind] ?? KIND_META.Aporte;
                const KindIcon = meta.icon;
                const scope = axisScope(contribution.axis);
                const rev = aporteNeedsReview(contribution);

                return (
                  <article
                    key={contribution.id}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition duration-150 hover:border-white/25"
                  >
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: meta.rail }} aria-hidden />
                    <button
                      type="button"
                      onClick={() => toggleAporte(contribution.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 py-3 pl-4 pr-4 text-left transition hover:bg-white/[0.03]"
                    >
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-black ${meta.badge}`}>
                        <KindIcon className="h-3 w-3" />
                        {contribution.kind}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-white">
                          {contribution.zone}
                          <span className="ml-2 text-xs font-bold text-slate-500">{contribution.name}</span>
                        </span>
                      </span>
                      {scope === "none" ? (
                        <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-slate-400 sm:inline">Sin clasificar</span>
                      ) : scope === "out" ? (
                        <span className="hidden shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[11px] font-black text-amber-100 sm:inline" title="El Codigo de Planeamiento no regula este tema">{contribution.axis}</span>
                      ) : (
                        <span className="hidden shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black text-emerald-100 sm:inline">{contribution.axis}</span>
                      )}
                      {rev ? (
                        <span className="hidden shrink-0 items-center gap-1 text-[10px] font-black text-amber-300 md:inline-flex">
                          <AlertTriangle className="h-3 w-3" />
                          revisar
                        </span>
                      ) : null}
                      <span className="hidden shrink-0 text-xs font-bold tabular-nums text-slate-500 lg:block">{formatContributionDate(contribution.createdAt)}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded ? (
                      <div className="px-4 pb-4 pl-5">
                        <p className="whitespace-pre-line border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">{contribution.text}</p>
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
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {contributionRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm leading-6 text-slate-400">
                  Ningún aporte coincide con los filtros.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm leading-6 text-slate-400">
            Todavia no hay aportes enviados desde la landing. Cuando un vecino complete el formulario publico, aparecera aca con su detalle completo.
          </div>
        )}
      </section>

    </AppShell>
  );
}

/**
 * Plantillas de arranque. El texto se edita a mano: son un punto de partida, no un envío automático.
 *
 * Las dos le escriben al autor del aporte (el destinatario es contribution.email),
 * así que ninguna puede tratarlo como infractor: quien reporta un problema no es
 * quien lo causó. La Citación lo cita a ampliar y ratificar lo que él mismo
 * presentó, que es lo único coherente con ese destinatario. Para intimar a un
 * infractor haría falta su correo, que el sistema no tiene.
 *
 * Registro: el cuerpo le habla al vecino y los corchetes le hablan a quien redacta.
 * Por eso la Devolución vosea al vecino, la Citación lo trata de usted (es un acto
 * formal) y los corchetes vosean en las dos: cambia el destinatario, no el criterio.
 */
const CONTACT_TEMPLATES = [
  {
    id: "devolucion",
    label: "Devolución",
    subject: (c: CitizenContribution) => `Tu ${c.kind.toLowerCase()} sobre ${c.zone} - Municipalidad de San Miguel de Tucumán`,
    body: (c: CitizenContribution) =>
      [
        `Estimado/a ${c.name}:`,
        "",
        // "tu ${kind}" y no "el/la ${kind}": kind es Propuesta (femenino), Reclamo o
        // Aporte, y cualquier artículo fijo rompe con alguno de los tres.
        `Nos comunicamos desde la Municipalidad de San Miguel de Tucumán en relación a tu ${c.kind.toLowerCase()} sobre ${c.zone}.`,
        "",
        "[Escribí acá la devolución: en qué estado está, qué se revisó y cuáles son los próximos pasos.]",
        "",
        "Gracias por participar en la construcción de la ciudad.",
        "",
        "Atentamente,",
        "[Tu nombre y área]",
        "Municipalidad de San Miguel de Tucumán"
      ].join("\n")
  },
  {
    id: "citacion",
    label: "Citación",
    subject: (c: CitizenContribution) => `Citación - Ampliación de su ${c.kind.toLowerCase()} sobre ${c.zone}`,
    body: (c: CitizenContribution) =>
      [
        `Estimado/a ${c.name}:`,
        "",
        `Por medio de la presente se lo/a cita a comparecer ante la Municipalidad de San Miguel de Tucumán a fin de ampliar y ratificar su ${c.kind.toLowerCase()} sobre ${c.zone}.`,
        "",
        "[Detallá acá: fecha y hora de la citación, dependencia y oficina, y qué documentación o registro conviene que traiga.]",
        "",
        "Su presentación ya fue recibida y está en análisis. Esta citación es para completar la información que usted aportó y no implica ninguna imputación en su contra.",
        "",
        "Ante cualquier duda puede responder a este correo.",
        "",
        "Atentamente,",
        "[Tu nombre y área]",
        "Municipalidad de San Miguel de Tucumán"
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

// Tarjeta de resumen. Cada tono se relaciona con su tema (revisión = ámbar,
// evaluación = violeta, fuera del CPU = neutro). Son ilustrativas, no
// interactivas; el hover solo las eleva apenas para que se sientan vivas.
const STAT_TONES: Record<string, string> = {
  sky: "border-sky-400/20 bg-sky-400/[0.07] text-sky-100 hover:border-sky-400/40",
  amber: "border-amber-400/20 bg-amber-400/[0.07] text-amber-100 hover:border-amber-400/40",
  violet: "border-violet-400/20 bg-violet-400/[0.07] text-violet-100 hover:border-violet-400/40",
  slate: "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25"
};

function StatCard({ value, label, tone }: { value: number; label: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className={`rounded-xl border p-3.5 transition duration-200 hover:-translate-y-0.5 ${STAT_TONES[tone]}`}>
      <p className="text-2xl font-black tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.12em] opacity-70">{label}</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-black transition ${
        active
          ? "border-sky-300/50 bg-sky-400/15 text-sky-100"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
