import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircleQuestion, MessagesSquare, Plus } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PageTour } from "@/components/help/page-tour";
import { FORO_TOUR } from "@/components/help/internal-tour-content";
import { canViewInternal, getSessionUser } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { listDebates } from "@/lib/foro/data";
import { debateStatusBadgeClasses, debateStatusLabels } from "@/lib/foro/shared";
import { formatDate } from "@/components/settings/format";
import type { DebateStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Foro de debates | UrbanIA",
  description: "Foro interno de deliberación del equipo municipal."
};

type PageProps = {
  searchParams?: Promise<{ estado?: string }>;
};

const statusFilters: { key: string; status?: DebateStatus; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "abiertos", status: "OPEN", label: "Abiertos" },
  { key: "cerrados", status: "CLOSED", label: "Cerrados" },
  { key: "archivados", status: "ARCHIVED", label: "Archivados" }
];

export default async function ForoPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) redirect("/ingresar");
  // Foro interno: el rol Consulta lee; los ciudadanos no acceden por ahora.
  if (!canViewInternal(session)) redirect("/");

  const params = await searchParams;
  const activeFilter = statusFilters.find((filter) => filter.key === params?.estado) ?? statusFilters[0];
  const debates = await listDebates(activeFilter.status);
  const canCreate = hasPermission(session, "debates.create");

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Deliberación interna</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">Foro de debates</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Preguntas urbanas concretas para debatir con postura entre equipos, antes de decidir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageTour tourId="foro" steps={FORO_TOUR} />
          {canCreate ? (
            <Link href="/foro/nuevo" data-tour="foro-nuevo" className="urban-button flex items-center gap-2 rounded-xl bg-[#1f89f6] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)] hover:bg-[#087bec]">
              <Plus className="h-4 w-4" />
              Nuevo debate
            </Link>
          ) : null}
        </div>
      </div>

      <nav data-tour="foro-filtros" aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-1.5">
        {statusFilters.map((filter) => {
          const active = filter.key === activeFilter.key;
          return (
            <Link
              key={filter.key}
              href={filter.key === "todos" ? "/foro" : `/foro?estado=${filter.key}`}
              aria-current={active ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
                  : "border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-200"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {debates.length === 0 ? (
        <section className="surface-panel grid place-items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
            <MessageCircleQuestion className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
            {activeFilter.status ? `No hay debates ${activeFilter.label.toLowerCase()}` : "Todavía no hay debates"}
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-400 dark:text-slate-500">
            {canCreate
              ? "Abrí el primero: una pregunta concreta, su contexto y, si aplica, la propuesta o proyecto al que responde."
              : "Cuando un administrador abra un debate, va a aparecer acá para que el equipo participe."}
          </p>
          {canCreate ? (
            <Link href="/foro/nuevo" className="mt-4 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300">
              Crear el primer debate
            </Link>
          ) : null}
        </section>
      ) : (
        <div data-tour="foro-lista" className="space-y-3">
          {debates.map((debate) => (
            <Link
              key={debate.id}
              href={`/foro/${debate.id}`}
              className="surface-panel urban-lift flex items-center gap-4 p-4 transition hover:border-sky-300/60 dark:hover:border-sky-400/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-slate-950 dark:text-white">{debate.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {debate.hearingTitle ? `Audiencia: ${debate.hearingTitle}` : debate.linkedLabel ?? "Sin audiencia registrada"}
                  {debate.hearingTitle && debate.linkedLabel ? ` · ${debate.linkedLabel}` : ""}
                  {debate.closesAt ? ` · cierra ${formatDate(debate.closesAt)}` : ""}
                  {debate.createdByName ? ` · abierto por ${debate.createdByName}` : ""}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${debateStatusBadgeClasses[debate.status]}`}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {debateStatusLabels[debate.status]}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <MessagesSquare className="h-4 w-4" aria-hidden />
                {debate.argumentCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
