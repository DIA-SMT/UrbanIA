import { CheckCircle2, CircleDashed, Fingerprint, Link2, ShieldCheck, TriangleAlert, UserCheck } from "lucide-react";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { ciditucIntegrationStatus, diagnosticarCidituc, type CiditucDiagnostico } from "@/lib/auth/identity/cidituc";

/** Verde solo si el backend responde como corresponde; el resto pide acción. */
const diagnosticoClases: Record<CiditucDiagnostico["estado"], string> = {
  OK: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200",
  RUTA_INCORRECTA: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200",
  SIN_RESPUESTA: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200",
  RESPUESTA_RARA: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
  NO_CONFIGURADO: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200"
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Integración Cidituc | Configuración | UrbanIA"
};

const flowSteps = [
  { icon: Fingerprint, title: "La identidad nace en Cidituc", detail: "Toda persona se autentica primero en el sistema de identidad municipal. UrbanIA nunca recibe su contraseña." },
  { icon: ShieldCheck, title: "UrbanIA valida el token", detail: "El servidor consulta Cidituc y exige que la identidad esté validada y habilitada antes de crear una sesión." },
  { icon: Link2, title: "La cuenta se crea o vincula", detail: "En el primer ingreso se crea automáticamente una cuenta ciudadana; si ya existe por DNI o correo, se vincula sin duplicarla." },
  { icon: UserCheck, title: "UrbanIA conserva los permisos", detail: "Las cuentas nuevas reciben rol Ciudadano. Las cuentas existentes mantienen el rol y el estado administrados en UrbanIA." }
];

export default async function CiditucPage() {
  await requireSettingsAccess("settings.manage");
  const status = ciditucIntegrationStatus();
  const diagnostico = await diagnosticarCidituc();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Integración Cidituc</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Fuente única de identidad de la Municipalidad. UrbanIA delega en Cidituc quién es cada persona y se queda con qué puede hacer.
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
            <ConfigItem ok={status.enabled} label="Integración habilitada" detail="Variable CIDITUC_ENABLED del entorno." />
            <ConfigItem ok={status.derivadorUrlConfigured} label="Derivador de identidad" detail="Variable CIDITUC_DERIVADOR_URL del entorno." />
            <ConfigItem ok={status.apiUrlConfigured} label="API de validación" detail="Variable CIDITUC_API_URL del entorno." />
            <ConfigItem ok={status.callbackUrlConfigured} label="Callback de UrbanIA" detail="Variable CIDITUC_CALLBACK_URL del entorno." />
          </ul>
          <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-white/10">
            <h4 className="text-sm font-black text-slate-950 dark:text-white">Prueba de conexión</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Se consulta la API con un token inválido a propósito: si todo está bien, tiene que rechazarlo.
            </p>
            <div className={`mt-3 rounded-xl border p-3.5 ${diagnosticoClases[diagnostico.estado]}`}>
              <p className="flex items-center gap-1.5 text-sm font-bold">
                {diagnostico.estado === "OK" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {diagnostico.titulo}
              </p>
              <p className="mt-1 text-xs leading-5">{diagnostico.detalle}</p>
              {diagnostico.host ? (
                <p className="mt-1.5 text-[11px] font-semibold opacity-80">Host consultado: {diagnostico.host}</p>
              ) : null}
            </div>
          </div>

          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-3.5 text-xs leading-5 text-slate-500 dark:border-white/15 dark:text-slate-400">
            Cidituc es el único acceso al sistema. UrbanIA valida el token recibido, aprovisiona la cuenta local y emite una sesión propia; los roles, permisos, suspensiones y auditoría permanecen bajo control de UrbanIA.
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
