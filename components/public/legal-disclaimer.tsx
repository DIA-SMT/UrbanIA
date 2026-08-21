"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { LEGAL_VERSION } from "@/lib/legal/content";

/**
 * Aviso que se muestra al entrar a la aplicación y hay que aceptar.
 *
 * La aceptación se guarda en localStorage con la VERSIÓN del documento, no con
 * un `true`: si algún día se corrigen los términos, la versión cambia y el aviso
 * vuelve a aparecer una vez. Con un booleano, quien aceptó la versión 1.0 nunca
 * volvería a ver nada.
 *
 * Límite conocido y aceptado: localStorage es por NAVEGADOR, no por persona. La
 * misma persona vuelve a aceptar en el teléfono, y no queda constancia de que
 * aceptó. Para un aviso de beta alcanza; si hiciera falta probar la aceptación,
 * hay que registrarla en la base contra el usuario.
 */

const CLAVE = "urbania-legal-aceptado";

/**
 * Pantallas donde el aviso NO aparece.
 *
 * /privacidad y /terminos son las que explican lo que se está aceptando:
 * taparlas con el aviso obligaría a aceptar sin poder leer, y encima son las que
 * abren sus propios enlaces.
 *
 * /ingresar está por prolijidad y no porque haga falta: sin sesión el aviso
 * nunca aparece, y CON sesión esa ruta redirige sola a /admin o a la portada
 * (app/ingresar/page.tsx), así que nadie se queda parado ahí.
 */
const EXCLUIDAS = ["/privacidad", "/terminos", "/ingresar"];

export function LegalDisclaimer() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<"cargando" | "oculto" | "visible">("cargando");

  useEffect(() => {
    if (EXCLUIDAS.includes(pathname)) {
      setEstado("oculto");
      return;
    }

    // Primero localStorage: si ya aceptó esta versión no se consulta nada al
    // servidor. El caso habitual no cuesta ni una petición.
    let aceptado: string | null = null;
    try {
      aceptado = window.localStorage.getItem(CLAVE);
    } catch {
      // Navegador con almacenamiento bloqueado: se pregunta de nuevo, que es el
      // comportamiento seguro. Molesta, pero no rompe.
    }
    if (aceptado === LEGAL_VERSION) {
      setEstado("oculto");
      return;
    }

    // Solo se le pide aceptar a quien entró: a alguien que está mirando la
    // portada sin cuenta no se le tapa la pantalla con un aviso legal.
    let vigente = true;
    fetch("/api/auth?action=me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user?: { name: string } | null }) => {
        if (vigente) setEstado(data.user ? "visible" : "oculto");
      })
      .catch(() => {
        if (vigente) setEstado("oculto");
      });

    return () => {
      vigente = false;
    };
  }, [pathname]);

  function aceptar() {
    try {
      window.localStorage.setItem(CLAVE, LEGAL_VERSION);
    } catch {
      // Si no se puede guardar, se continúa igual: bloquear el acceso porque el
      // navegador no tiene almacenamiento sería peor que volver a preguntar.
    }
    setEstado("oculto");
  }

  async function rechazar() {
    // Rechazar cierra la sesión. Dejarlo entrar sin aceptar convertiría el aviso
    // en decorativo, y un modal sin salida es una trampa.
    await fetch("/api/auth?action=logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/";
  }

  if (estado !== "visible" || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#08121f]/70 p-4 text-left backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-legal-titulo"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(2,6,23,0.4)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 id="aviso-legal-titulo" className="mt-4 font-display text-xl font-extrabold tracking-[-0.02em] text-slate-900">
            Antes de empezar
          </h2>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900">
            <strong className="font-black">UrbanIA está en versión beta.</strong> Es una plataforma en construcción:
            puede tener errores, estar fuera de servicio sin aviso y cambiar mientras avanza.
          </div>

          <ul className="mt-4 grid gap-2.5">
            <Punto>
              Presentar una propuesta o un reclamo acá <strong className="font-bold text-slate-900">no inicia un
              trámite</strong> ni un expediente, y no interrumpe plazos.
            </Punto>
            <Punto>
              Migue, el asistente, <strong className="font-bold text-slate-900">puede equivocarse</strong>. Sus
              respuestas son orientativas: ante cualquier diferencia vale el texto oficial de la ordenanza.
            </Punto>
            <Punto>
              Tu nombre, DNI y correo llegan desde Ciudadano Digital. El{" "}
              <strong className="font-bold text-slate-900">texto que escribís se procesa con inteligencia
              artificial</strong> para moderarlo y clasificarlo.
            </Punto>
            <Punto>
              Tus datos personales <strong className="font-bold text-slate-900">no se publican</strong> en el portal.
            </Punto>
          </ul>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
            {/* Se abren en otra pestaña y no en otro recuadro: un modal sobre el
                modal deja al lector sin saber cuál cierra con Escape. */}
            <Enlace href="/terminos">Términos de Uso completos</Enlace>
            <Enlace href="/privacidad">Política de Privacidad completa</Enlace>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={rechazar}
              className="rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition hover:text-slate-900"
            >
              Salir sin aceptar
            </button>
            <button
              type="button"
              onClick={aceptar}
              autoFocus
              className="urban-button inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f89f6] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0066ff]"
            >
              <ShieldCheck className="h-4 w-4" />
              Entendido, acepto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-5 text-[13px] leading-6 text-slate-600">
      <span aria-hidden className="absolute left-0 top-[0.62em] h-1.5 w-1.5 rounded-full bg-civic-blue-deep" />
      {children}
    </li>
  );
}

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-civic-blue-deep underline-offset-4 hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {children}
    </a>
  );
}
