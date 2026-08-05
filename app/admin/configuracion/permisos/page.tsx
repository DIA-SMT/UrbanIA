import { Check, Minus } from "lucide-react";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { PERMISSION_CATALOG, permissionsForRole } from "@/lib/auth/permissions";
import { ROLE_ORDER, roleLabels } from "@/lib/settings/shared";

export const metadata = {
  title: "Permisos | Configuración | UrbanIA"
};

export default async function PermisosPage() {
  await requireSettingsAccess("roles.manage");

  const modules = Array.from(new Set(PERMISSION_CATALOG.map((permission) => permission.module)));
  const granted = new Map(ROLE_ORDER.map((role) => [role, new Set(permissionsForRole(role))]));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Permisos</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Matriz de permisos por rol. El servidor valida cada operación contra esta matriz: cambiar un permiso cambia lo que el rol puede hacer, sin tocar pantallas.
        </p>
      </div>
      <section className="surface-panel overflow-hidden">
        <div className="urban-scrollbar overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:border-white/10 dark:text-slate-500">
                <th scope="col" className="px-4 py-3">Permiso</th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} scope="col" className="px-3 py-3 text-center">{roleLabels[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <ModuleRows key={module} module={module} granted={granted} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        En la Fase 2 esta matriz pasa a la base de datos y se vuelve editable, con permisos personalizados por usuario.
      </p>
    </div>
  );
}

function ModuleRows({
  module,
  granted
}: {
  module: string;
  granted: Map<(typeof ROLE_ORDER)[number], Set<string>>;
}) {
  const rows = PERMISSION_CATALOG.filter((permission) => permission.module === module);
  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.02]">
        <th colSpan={1 + ROLE_ORDER.length} scope="colgroup" className="px-4 py-2 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {module}
        </th>
      </tr>
      {rows.map((permission) => (
        <tr key={permission.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.03]">
          <td className="px-4 py-2.5">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{permission.label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{permission.description}</p>
          </td>
          {ROLE_ORDER.map((role) => {
            const has = granted.get(role)?.has(permission.key) ?? false;
            return (
              <td key={role} className="px-3 py-2.5 text-center">
                {has ? (
                  <Check aria-hidden className="mx-auto h-4 w-4 text-emerald-500" />
                ) : (
                  <Minus aria-hidden className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
                )}
                <span className="sr-only">{has ? "Permitido" : "No permitido"}</span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
