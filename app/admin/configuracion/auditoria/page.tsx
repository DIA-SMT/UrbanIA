import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { formatDateTime } from "@/components/settings/format";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { AUDIT_ACTIONS, auditActionLabel, type AuditAction } from "@/lib/settings/audit";
import { listAuditEntries } from "@/lib/settings/users";
import { fullName } from "@/lib/settings/shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Auditoría | Configuración | UrbanIA"
};

type PageProps = {
  searchParams?: Promise<{ action?: string; page?: string }>;
};

export default async function AuditoriaPage({ searchParams }: PageProps) {
  await requireSettingsAccess("audit.view");
  const params = await searchParams;
  const action = params?.action && params.action in AUDIT_ACTIONS ? params.action : undefined;
  const page = Math.max(1, Number(params?.page) || 1);

  const { entries, total, pageSize } = await listAuditEntries({ action, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterHref = (nextAction?: string, nextPage?: number) => {
    const query = new URLSearchParams();
    if (nextAction) query.set("action", nextAction);
    if (nextPage && nextPage > 1) query.set("page", String(nextPage));
    const suffix = query.toString();
    return `/admin/configuracion/auditoria${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Auditoría</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Bitácora inmutable de la administración de usuarios: quién hizo qué, sobre quién, cuándo y desde dónde.
        </p>
      </div>

      <nav aria-label="Filtrar por acción" className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href={filterHref()} active={!action} label="Todas" />
        {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((key) => (
          <FilterChip key={key} href={filterHref(key)} active={action === key} label={AUDIT_ACTIONS[key]} />
        ))}
      </nav>

      <section className="surface-panel overflow-hidden">
        {entries.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
              <ScrollText className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Sin registros{action ? " para este filtro" : ""}</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-400 dark:text-slate-500">
              Cada cambio de rol, suspensión, reactivación o edición de perfil se asienta acá automáticamente.
            </p>
          </div>
        ) : (
          <div className="urban-scrollbar overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:border-white/10 dark:text-slate-500">
                  <th scope="col" className="px-4 py-3">Fecha y hora</th>
                  <th scope="col" className="px-3 py-3">Acción</th>
                  <th scope="col" className="px-3 py-3">Responsable</th>
                  <th scope="col" className="px-3 py-3">Usuario afectado</th>
                  <th scope="col" className="px-3 py-3">Cambio</th>
                  <th scope="col" className="px-3 py-3">Motivo</th>
                  <th scope="col" className="px-3 py-3">IP / Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{auditActionLabel(entry.action)}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{entry.actor ? fullName(entry.actor) : "Sistema"}</td>
                    <td className="px-3 py-3">
                      {entry.targetUser ? (
                        <Link href={`/admin/configuracion/usuarios/${entry.targetUser.id}`} className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">
                          {fullName(entry.targetUser)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {entry.previousValue && entry.newValue ? `${entry.previousValue} → ${entry.newValue}` : "—"}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{entry.reason ?? "—"}</td>
                    <td className="max-w-[180px] px-3 py-3 text-xs leading-5 text-slate-400 dark:text-slate-500">
                      {entry.ip ?? "—"}
                      {entry.userAgent ? <span className="block truncate" title={entry.userAgent}>{entry.userAgent}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-white/10">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {total} registro{total === 1 ? "" : "s"} · página {page} de {totalPages}
          </p>
          <div className="flex gap-1.5">
            <PagerLink href={filterHref(action, page - 1)} disabled={page <= 1} label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </PagerLink>
            <PagerLink href={filterHref(action, page + 1)} disabled={page >= totalPages} label="Página siguiente">
              <ChevronRight className="h-4 w-4" />
            </PagerLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
          : "border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-200"
      }`}
    >
      {label}
    </Link>
  );
}

function PagerLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-300 dark:border-white/10 dark:text-slate-600">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300">
      {children}
    </Link>
  );
}
