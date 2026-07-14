import Link from "next/link";
import type { ProposalStatus } from "@prisma/client";
import { ArrowLeft, CalendarDays, Check, Circle, MapPin, MessageSquare, ThumbsUp, Users } from "lucide-react";
import { proposalSourceLabels, proposalStatusLabels, type ProposalListItem } from "@/lib/proposals/shared";

/**
 * Ficha de un proyecto (propuesta en etapa avanzada) construida solo con los
 * campos reales del modelo Proposal. Crece a medida que el modelo incorpore
 * presupuesto, plazos, documentos o responsables.
 */

const stageOrder: ProposalStatus[] = ["SUBMITTED", "UNDER_REVIEW", "FEASIBLE", "APPROVED", "IN_PROGRESS", "COMPLETED"];

const stageLabels: Partial<Record<ProposalStatus, string>> = {
  SUBMITTED: "Presentada",
  UNDER_REVIEW: "Revision",
  FEASIBLE: "Factible",
  APPROVED: "Aprobada",
  IN_PROGRESS: "Ejecucion",
  COMPLETED: "Finalizada"
};

export function ProjectDetail({ project }: { project: ProposalListItem }) {
  const currentStage = stageOrder.indexOf(project.status);

  return (
    <div className="space-y-4">
      <section className="urban-card overflow-hidden rounded-lg">
        <div className="border-b border-white/10 p-5 md:p-7">
          <p className="text-xs font-bold text-slate-400">
            <Link href="/proyectos" className="transition hover:text-sky-300">Proyectos</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-200">{project.title}</span>
          </p>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-4xl">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-black text-sky-200">
                  {proposalStatusLabels[project.status]}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">
                  {proposalSourceLabels[project.source]}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-white md:text-4xl">{project.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{project.description}</p>
            </div>
            <Link href="/proyectos" className="urban-button inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Volver a la cartera
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Meta icon={CalendarDays} label="Registrada" value={new Date(project.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })} />
            <Meta icon={Users} label="Origen" value={proposalSourceLabels[project.source]} />
            <Meta icon={ThumbsUp} label="Apoyos" value={project.votes.toString()} />
            <Meta icon={MessageSquare} label="Comentarios" value={project.comments.toString()} />
          </div>
        </div>

        {currentStage >= 0 ? (
          <div className="p-5 md:p-7">
            <div className="relative grid min-w-0 grid-cols-6">
              <div className="absolute left-[8%] right-[8%] top-4 h-px bg-white/10" />
              {stageOrder.map((stage, index) => {
                const state = index < currentStage ? "done" : index === currentStage ? "current" : "pending";
                return (
                  <div key={stage} className="relative z-10 text-center">
                    <span
                      className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-4 border-[#0d1b2a] ${
                        state === "done"
                          ? "bg-emerald-500 text-white"
                          : state === "current"
                            ? "bg-[#1f89f6] text-white ring-4 ring-sky-400/15"
                            : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {state === "done" ? <Check className="h-4 w-4" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
                    </span>
                    <span className="mt-2 block text-[10px] font-bold text-slate-500 sm:text-xs">{stageLabels[stage]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {project.citizen ? (
          <article className="urban-card rounded-lg p-5">
            <h2 className="flex items-center gap-2 font-black text-white">
              <Users className="h-4 w-4 text-civic-sky" />
              Origen ciudadano
            </h2>
            <div className="mt-4 grid gap-3">
              <DetailBlock label="Vecino/a" value={project.citizen.name} />
              <DetailBlock label="Zona" value={project.citizen.zone} />
              <DetailBlock label="Eje detectado" value={project.citizen.axis} />
            </div>
          </article>
        ) : null}

        <article className="urban-card rounded-lg p-5">
          <h2 className="flex items-center gap-2 font-black text-white">
            <MapPin className="h-4 w-4 text-civic-sky" />
            Ubicacion
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            {project.latitude != null && project.longitude != null
              ? `Coordenadas: ${project.latitude.toFixed(5)}, ${project.longitude.toFixed(5)}`
              : "Sin ubicacion georreferenciada registrada para este proyecto."}
          </p>
        </article>
      </section>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <Icon className="h-4 w-4 text-[#1f89f6]" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
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
