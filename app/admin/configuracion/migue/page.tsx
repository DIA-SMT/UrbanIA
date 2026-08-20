import Link from "next/link";
import { MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { formatDateTime } from "@/components/settings/format";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { getMigueStats, type MigueStatsWindow } from "@/lib/settings/migue-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Consultas a Migue | Configuración | UrbanIA"
};

const WINDOWS: MigueStatsWindow[] = [7, 30, 90];

/** Etiquetas legibles de los canales por los que se le pregunta a Migue. */
const MODULE_LABELS: Record<string, string> = {
  "consulta-cpu": "Consulta CPU",
  cpu: "Consulta CPU",
  asistente: "Chat de Migue",
  portal: "Chat en el portal",
  interno: "Chat en el sistema interno"
};

type PageProps = {
  searchParams?: Promise<{ dias?: string }>;
};

export default async function MigueStatsPage({ searchParams }: PageProps) {
  await requireSettingsAccess("audit.view");
  const params = await searchParams;
  const parsed = Number(params?.dias);
  const days: MigueStatsWindow = WINDOWS.includes(parsed as MigueStatsWindow) ? (parsed as MigueStatsWindow) : 30;

  const stats = await getMigueStats(days);
  const answered = stats.total - stats.unanswered;
  // La escala de las barras es el día más movido: comparar días entre sí es lo
  // que importa, no compararlos contra un máximo fijo inventado.
  const peak = stats.daily.reduce((max, entry) => Math.max(max, entry.total), 0);
  const topCitations = stats.topSources[0]?.citations ?? 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Consultas a Migue</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Qué le pregunta la gente al asistente y qué no pudo responder. Reúne el chat de Migue y la Consulta CPU. Las
          consultas se registran sin identificar quién preguntó.
        </p>
      </div>

      <nav aria-label="Ventana de tiempo" className="mb-4 flex flex-wrap gap-1.5">
        {WINDOWS.map((value) => (
          <Link
            key={value}
            href={value === 30 ? "/admin/configuracion/migue" : `/admin/configuracion/migue?dias=${value}`}
            aria-current={days === value ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              days === value
                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
                : "border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-200"
            }`}
          >
            Últimos {value} días
          </Link>
        ))}
      </nav>

      {/* El vacío se muestra solo si NO hubo nada: si en la ventana solo entraron
          mensajes descartados, el panel se dibuja igual para que ese número se vea
          en vez de quedar tapado por un "sin consultas". */}
      {stats.total === 0 && stats.discarded === 0 ? (
        <section className="surface-panel grid place-items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
            <MessageCircleQuestion className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Sin consultas en esta ventana</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-400 dark:text-slate-500">
            Cada pregunta al chat de Migue y a la Consulta CPU se registra acá automáticamente. Probá una ventana más
            amplia.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Consultas reales"
              value={stats.total.toLocaleString("es-AR")}
              hint={`${answered.toLocaleString("es-AR")} con respaldo · ${stats.normative.toLocaleString("es-AR")} sobre normativa`}
            />
            <StatCard
              label="Falta cargar"
              value={`${stats.unansweredRate}%`}
              hint={`${stats.unanswered.toLocaleString("es-AR")} que el Código sí regula y Migue no encontró`}
              tone={stats.unansweredRate >= 25 ? "warn" : "plain"}
            />
            <StatCard
              label="Fuera del Código"
              value={stats.outOfScope.toLocaleString("es-AR")}
              hint="lo que la gente espera que el CPU regule y no regula"
            />
            <StatCard
              label="Faltó un dato"
              value={stats.missingInput.toLocaleString("es-AR")}
              hint="Migue pidió el distrito para poder responder"
            />
            <StatCard
              label="Descartadas"
              value={stats.discarded.toLocaleString("es-AR")}
              hint="saludos, pruebas, tecleo al azar"
            />
            <StatCard
              label="Valoraciones"
              value={`${stats.feedback.up} / ${stats.feedback.down}`}
              hint="a favor / en contra"
              icons
            />
          </div>

          <section className="surface-panel p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Consultas por día</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              La franja más clara marca las que quedaron sin respaldo.
            </p>
            <div className="mt-4 flex items-end gap-[3px]" style={{ height: "140px" }}>
              {stats.daily.map((entry) => {
                const height = peak === 0 ? 0 : Math.max(3, Math.round((entry.total / peak) * 100));
                const unansweredShare = entry.total === 0 ? 0 : Math.round((entry.unanswered / entry.total) * 100);
                return (
                  <div
                    key={entry.day}
                    className="group relative flex-1 rounded-t bg-[#1f89f6]"
                    style={{ height: `${height}%`, minWidth: "6px" }}
                    title={`${entry.day} · ${entry.total} consulta${entry.total === 1 ? "" : "s"}, ${entry.unanswered} sin respuesta`}
                  >
                    <span
                      className="absolute inset-x-0 top-0 rounded-t bg-sky-300/70"
                      style={{ height: `${unansweredShare}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <span>{stats.daily[0]?.day ?? "—"}</span>
              <span>{stats.daily[stats.daily.length - 1]?.day ?? "—"}</span>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-panel p-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Por canal</h3>
              <ul className="mt-3 grid gap-2">
                {stats.byModule.map((entry) => (
                  <li key={entry.module} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200">
                      {MODULE_LABELS[entry.module] ?? entry.module}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">{entry.total}</span>
                      {entry.unanswered > 0 ? ` · ${entry.unanswered} sin respuesta` : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface-panel p-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Motivos de los pulgares abajo</h3>
              {stats.feedback.reasons.length === 0 ? (
                <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">
                  Nadie eligió un motivo al marcar una respuesta como mala en esta ventana.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {stats.feedback.reasons.map((entry) => (
                    <li key={entry.reason} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{entry.reason}</span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="surface-panel p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Lo más consultado del Código</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Artículos y documentos que Migue citó para responder. Es la lectura más directa de qué le interesa a la
              gente, sin necesidad de clasificar los temas.
            </p>
            {stats.topSources.length === 0 ? (
              <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">
                Todavía no hay respuestas con citas en esta ventana.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2.5">
                {stats.topSources.map((entry) => (
                  <li key={entry.reference}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100">{entry.reference}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                        {entry.citations}
                      </span>
                    </div>
                    {entry.title ? (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{entry.title}</p>
                    ) : null}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-[#1f89f6]"
                        style={{ width: `${topCitations === 0 ? 0 : Math.round((entry.citations / topCitations) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface-panel p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Consultas sobre temas que faltan cargar</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Preguntas que el Código sí regula y que Migue no pudo respaldar con ningún fragmento. Acá NO entran las que
              contestó bien sin citar —cuando avisó que el tema está fuera del Código, o cuando pidió el distrito para
              poder responder—, que se cuentan arriba por separado.
            </p>
            {stats.recentUnanswered.length === 0 ? (
              <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">
                Ninguna consulta quedó sin respaldo en esta ventana.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {stats.recentUnanswered.map((entry) => (
                  <li key={entry.id} className="py-2.5">
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.question}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {formatDateTime(entry.createdAt)}
                      {entry.module ? ` · ${MODULE_LABELS[entry.module] ?? entry.module}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "plain",
  icons = false
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "plain" | "warn";
  icons?: boolean;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{label}</p>
      <p
        className={`mt-1.5 flex items-center gap-2 text-2xl font-black tabular-nums ${
          tone === "warn" ? "text-amber-600 dark:text-amber-300" : "text-slate-950 dark:text-white"
        }`}
      >
        {icons ? <ThumbsUp className="h-4 w-4 text-emerald-500" aria-hidden /> : null}
        {value}
        {icons ? <ThumbsDown className="h-4 w-4 text-rose-500" aria-hidden /> : null}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
