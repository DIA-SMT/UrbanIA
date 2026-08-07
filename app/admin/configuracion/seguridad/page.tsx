import { Clock3, KeyRound, Lock, ScrollText, ShieldCheck, UserX } from "lucide-react";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { statusLabels } from "@/lib/settings/shared";
import { StatusBadge } from "@/components/settings/badges";

export const metadata = {
  title: "Seguridad | Configuración | UrbanIA"
};

const policies = [
  {
    icon: KeyRound,
    title: "Autenticación",
    detail: "Cidituc es el único proveedor de identidad. UrbanIA valida cada token contra el backend municipal, crea o vincula la cuenta local y conserva aquí sus roles y permisos."
  },
  {
    icon: Clock3,
    title: "Sesiones",
    detail: "La sesión dura 8 horas y viaja en una cookie firmada (HMAC), httpOnly y limitada al sitio. Un cambio de rol o una suspensión aplican al próximo inicio de sesión."
  },
  {
    icon: ShieldCheck,
    title: "Autorización por permisos",
    detail: "Cada operación del servidor valida un permiso concreto, no un nombre de rol. Los roles son conjuntos de permisos y pueden evolucionar sin tocar el código de cada pantalla."
  },
  {
    icon: UserX,
    title: "Revocación sin borrado",
    detail: "Eliminar el acceso de una cuenta no borra sus datos: las propuestas, votos y auditoría se conservan. Ninguna cuenta puede quitarse el acceso a sí misma y el sistema nunca queda sin administradores activos."
  },
  {
    icon: ScrollText,
    title: "Auditoría íntegra",
    detail: "Cada cambio de rol, estado o perfil se registra junto con el cambio en la misma transacción: no existe modificación sin bitácora, con administrador responsable, IP y dispositivo."
  }
];

export default async function SeguridadPage() {
  await requireSettingsAccess("settings.manage");

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Seguridad</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Políticas de acceso vigentes en UrbanIA y ciclo de vida de las cuentas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {policies.map((policy) => {
          const Icon = policy.icon;
          return (
            <article key={policy.title} className="surface-panel p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">{policy.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{policy.detail}</p>
            </article>
          );
        })}

        <article className="surface-panel p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
              <Lock className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-black text-slate-950 dark:text-white">Estados de cuenta</h3>
          </div>
          <ul className="mt-3 space-y-2.5">
            {(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map((status) => (
              <li key={status} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <StatusBadge status={status} />
                <span className="text-xs leading-5">
                  {status === "PENDING" && "Identidad vinculada, a la espera de rol."}
                  {status === "ACTIVE" && "Cuenta operativa con su rol asignado."}
                  {status === "SUSPENDED" && "Bloqueo temporal decidido por un administrador."}
                  {status === "REVOKED" && "Acceso eliminado; los datos se conservan para auditoría."}
                  {status === "INACTIVE" && "Sin actividad prolongada; puede reactivarse."}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
