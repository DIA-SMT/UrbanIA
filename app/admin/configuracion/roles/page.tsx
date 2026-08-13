import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { RoleBadge } from "@/components/settings/badges";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { loadPermissionMatrix } from "@/lib/auth/permissions-store";
import { ROLE_ORDER, roleDescriptions, roleLabels } from "@/lib/settings/shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roles | Configuración | UrbanIA"
};

export default async function RolesPage() {
  await requireSettingsAccess("roles.manage");

  const [counts, matriz] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    loadPermissionMatrix()
  ]);
  const countByRole = new Map(counts.map((row) => [row.role, row._count._all]));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Roles</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Un rol es un conjunto de permisos, no una lista de pantallas. Los roles son fijos, pero qué permisos incluye cada uno se edita en la pestaña Permisos.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ROLE_ORDER.map((role) => {
          const permissions = matriz.get(role) ?? new Set();
          const total = countByRole.get(role) ?? 0;
          return (
            <article key={role} className="surface-panel p-5 transition-shadow duration-200 hover:shadow-card-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-950 dark:text-white">{roleLabels[role]}</h3>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {total} usuario{total === 1 ? "" : "s"} · {permissions.size} permiso{permissions.size === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <RoleBadge role={role} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{roleDescriptions[role]}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
