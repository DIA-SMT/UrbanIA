import type { UserRole } from "@prisma/client";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { loadPermissionMatrix } from "@/lib/auth/permissions-store";
import { PermissionsMatrix } from "@/components/settings/permissions-matrix";
import { ROLE_ORDER } from "@/lib/settings/shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Permisos | Configuración | UrbanIA"
};

export default async function PermisosPage() {
  await requireSettingsAccess("roles.manage");

  const matriz = await loadPermissionMatrix();
  const matrizInicial: Record<string, string[]> = {};
  for (const role of ROLE_ORDER) {
    matrizInicial[role] = Array.from(matriz.get(role) ?? []);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Permisos</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Matriz de permisos por rol. El servidor valida cada operación contra esta matriz: cambiar un permiso cambia lo que el rol puede hacer, sin tocar pantallas.
        </p>
      </div>

      <PermissionsMatrix roles={ROLE_ORDER as UserRole[]} matrizInicial={matrizInicial} />

      <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">
        Los cambios rigen apenas se guardan, para todas las cuentas del rol, y quedan asentados en Auditoría. El sistema rechaza el único guardado del que no se puede volver: dejar sin ninguna cuenta activa que pueda administrar permisos.
      </p>
    </div>
  );
}
