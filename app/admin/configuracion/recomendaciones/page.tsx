import Link from "next/link";
import { AppFeedbackStatus } from "@prisma/client";
import { Lightbulb } from "lucide-react";
import { FeedbackList } from "@/components/settings/feedback-list";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { getFeedbackInbox } from "@/lib/settings/app-feedback";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recomendaciones | Configuración | UrbanIA"
};

const FILTERS: { label: string; value: AppFeedbackStatus | "todas" }[] = [
  { label: "Todas", value: "todas" },
  { label: "Sin leer", value: AppFeedbackStatus.NEW },
  { label: "Leídas", value: AppFeedbackStatus.REVIEWED },
  { label: "Archivadas", value: AppFeedbackStatus.ARCHIVED }
];

type PageProps = {
  searchParams?: Promise<{ estado?: string }>;
};

export default async function RecomendacionesPage({ searchParams }: PageProps) {
  /*
   * proposals.manage y no audit.view (que es lo que pide el panel de Migue): esta
   * pantalla muestra el nombre y el correo de quien escribio, y ese es el permiso
   * con el que el proyecto ya gobierna "leer lo que mandan los vecinos con sus
   * datos" (ver la entrada de Aportes ciudadanos en lib/data.ts). Las consultas a
   * Migue, en cambio, se registran sin identificar a nadie.
   */
  await requireSettingsAccess("proposals.manage");

  const params = await searchParams;
  const requested = FILTERS.find((filter) => filter.value === params?.estado)?.value;
  const status = requested && requested !== "todas" ? requested : undefined;

  const { entries, counts } = await getFeedbackInbox(status);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Recomendaciones</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Lo que los vecinos escriben sobre UrbanIA como herramienta: qué les costó, qué no funcionó y qué le
          agregarían. Llega desde el portal y no se publica en ningún lado.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Recibidas" value={counts.total} />
        <Metric label="Sin leer" value={counts.nuevas} highlight={counts.nuevas > 0} />
        <Metric
          label="Problemas sin leer"
          value={counts.problemas}
          detail="Algo que no funcionó"
          highlight={counts.problemas > 0}
        />
      </div>

      <nav aria-label="Estado" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const isActive = (params?.estado ?? "todas") === filter.value;
          return (
            <Link
              key={filter.value}
              href={
                filter.value === "todas"
                  ? "/admin/configuracion/recomendaciones"
                  : `/admin/configuracion/recomendaciones?estado=${filter.value}`
              }
              aria-current={isActive ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                isActive
                  ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
                  : "border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-200"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-14 text-center dark:border-white/10">
          <Lightbulb className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {status ? "No hay recomendaciones en este estado." : "Todavía no llegó ninguna recomendación."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-500">
            Los vecinos las dejan desde el portal, en la portada o en{" "}
            <span className="font-mono">/sugerencias</span>.
          </p>
        </div>
      ) : (
        <FeedbackList entries={entries} />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  highlight
}: {
  label: string;
  value: number;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-black tabular-nums ${
          highlight ? "text-sky-600 dark:text-sky-300" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{detail}</p> : null}
    </div>
  );
}
