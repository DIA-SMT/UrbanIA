import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Fingerprint, ShieldCheck } from "lucide-react";

type LoginPageProps = {
  initialError?: string;
  ciditucEnabled: boolean;
};

const errorMessages: Record<string, string> = {
  blocked: "Tu cuenta de UrbanIA no tiene acceso habilitado. Comunicate con la administración.",
  cidituc_unavailable: "Cidituc no está disponible o la integración no está configurada.",
  cidituc_invalid: "Cidituc no pudo validar la sesión. Volvé a intentarlo.",
  cidituc_inactive: "Tu cuenta de Cidituc no está validada o se encuentra deshabilitada.",
  cidituc_state: "La solicitud de acceso venció o no coincide. Iniciá el proceso nuevamente.",
  cidituc_conflict: "Los datos de Cidituc coinciden con más de una cuenta de UrbanIA. Comunicate con la administración.",
  cidituc_session_failed: "Validamos tu identidad, pero no pudimos crear la sesión de UrbanIA. Intentá nuevamente."
};

export function LoginPage({ initialError, ciditucEnabled }: LoginPageProps) {
  const errorMessage = initialError ? errorMessages[initialError] ?? "No pudimos completar el acceso. Intentá nuevamente." : null;

  return (
    <main className="min-h-screen bg-[#eff7fb] px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-50">
            <ArrowLeft className="h-4 w-4" />
            Volver al portal
          </Link>

          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/brand/logo-municipalidad-smt-transparent.png"
              alt="Municipalidad de San Miguel de Tucumán"
              width={48}
              height={48}
              priority
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="text-xl font-black leading-none text-slate-950">UrbanIA</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Acceso municipal</p>
            </div>
          </div>

          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-800">
            <ShieldCheck className="h-4 w-4" />
            Identidad verificada
          </div>
          <h1 className="text-2xl font-black leading-tight text-slate-950">Ingresar con Cidituc</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Usá tu cuenta de Ciudad Digital. En tu primer ingreso UrbanIA crea automáticamente tu cuenta ciudadana; no necesitás registrarte ni elegir otra contraseña.
          </p>

          {errorMessage ? (
            <div role="alert" className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-5 text-amber-900">
              {errorMessage}
            </div>
          ) : null}

          {ciditucEnabled ? (
            // Navegacion REAL del navegador, no <Link>: el endpoint responde un
            // redirect al Derivador de Cidituc, que es otro dominio. Con routing
            // del lado del cliente el redirect no se sigue y el login no arranca.
            // La regla lo marca desde que /api/auth es un catch-all y la confunde
            // con una pagina; es un endpoint.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/api/auth?action=cidituc-start" className="urban-button mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0284c7] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(2,132,199,0.22)] hover:bg-[#0369a1]">
              <Fingerprint className="h-4 w-4" />
              Ingresar con Cidituc
            </a>
          ) : (
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              El acceso con Cidituc está temporalmente deshabilitado.
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            UrbanIA nunca recibe ni almacena tu contraseña de Cidituc. Los roles y permisos se administran dentro del sistema municipal.
          </p>
        </section>
      </div>
    </main>
  );
}
