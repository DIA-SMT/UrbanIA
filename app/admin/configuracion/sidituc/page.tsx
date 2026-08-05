import { CheckCircle2, CircleDashed, Fingerprint, Link2, ShieldCheck, UserCheck } from "lucide-react";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { siditucIntegrationStatus } from "@/lib/auth/identity/sidituc";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Integración SIDITUC | Configuración | UrbanIA"
};

const flowSteps = [
  { icon: Fingerprint, title: "La identidad nace en SIDITUC", detail: "Toda persona que ingresa a UrbanIA existe primero en el sistema de identidad municipal. UrbanIA no crea usuarios." },
  { icon: ShieldCheck, title: "UrbanIA valida la identidad", detail: "Al solicitar acceso, la cuenta se verifica contra SIDITUC por DNI. Sin identidad válida, no hay ingreso." },
  { icon: Link2, title: "Se vincula la cuenta", detail: "La identidad verificada queda asociada a la cuenta de UrbanIA junto con sus datos canónicos." },
  { icon: UserCheck, title: "Un administrador asigna el rol", detail: "La cuenta vinculada entra como Pendiente hasta que un administrador le asigna rol desde Solicitudes de acceso." }
];

export default async function SiditucPage() {
  await requireSettingsAccess("settings.manage");
  const status = siditucIntegrationStatus();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Integración SIDITUC</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Fuente única de identidad de la Municipalidad. UrbanIA delega en SIDITUC quién es cada persona y se queda con qué puede hacer.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            status.enabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200"
          }`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.enabled ? "Integración activa" : "Pendiente de integración"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="surface-panel p-5">
          <h3 className="text-sm font-black text-slate-950 dark:text-white">Flujo de acceso</h3>
          <ol className="mt-4 space-y-4">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#1f89f6] dark:bg-sky-400/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      <span className="mr-1.5 text-slate-400">{index + 1}.</span>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="surface-panel p-5">
          <h3 className="text-sm font-black text-slate-950 dark:text-white">Estado de la configuración</h3>
          <ul className="mt-4 space-y-3">
            <ConfigItem ok={status.enabled} label="Integración habilitada" detail="Variable SIDITUC_ENABLED del entorno." />
            <ConfigItem ok={status.apiUrlConfigured} label="URL del servicio" detail="Variable SIDITUC_API_URL del entorno." />
            <ConfigItem ok={status.apiKeyConfigured} label="Credencial de acceso" detail="Variable SIDITUC_API_KEY del entorno." />
          </ul>
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-3.5 text-xs leading-5 text-slate-500 dark:border-white/15 dark:text-slate-400">
            La arquitectura ya contempla esta integración (capa de identidad en <code className="font-mono text-[11px]">lib/auth/identity</code>). Cuando el servicio esté disponible, se implementa la consulta por DNI y se habilita el flag, sin cambios en el resto del sistema. Mientras tanto, el acceso local con email y contraseña sigue operativo.
          </p>
        </section>
      </div>
    </div>
  );
}

function ConfigItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
      )}
      <div>
        <p className={`text-sm font-semibold ${ok ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
          {label}
          <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{ok ? "Configurado" : "Pendiente"}</span>
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{detail}</p>
      </div>
    </li>
  );
}
