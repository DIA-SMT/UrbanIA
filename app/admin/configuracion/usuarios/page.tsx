import { UsersDirectory } from "@/components/settings/users-directory";
import { siditucProvider } from "@/lib/auth/identity/sidituc";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { listCatalog, listUsers } from "@/lib/settings/users";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Usuarios | Configuración | UrbanIA"
};

export default async function UsuariosPage() {
  const session = await requireSettingsAccess("users.manage");
  const [initialData, catalog] = await Promise.all([listUsers({}), listCatalog()]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Usuarios</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cuentas del sistema y su nivel de acceso. UrbanIA no crea identidades: las valida y les asigna rol.
          </p>
        </div>
      </div>
      <UsersDirectory
        initialData={initialData}
        catalog={catalog}
        sessionUserId={session.userId}
        canCreateManually={!siditucProvider.isEnabled()}
      />
    </div>
  );
}
