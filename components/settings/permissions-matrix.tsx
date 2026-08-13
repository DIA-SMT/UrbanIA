"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { AlertTriangle, Check, Loader2, Minus, ShieldCheck, Undo2 } from "lucide-react";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { roleLabels } from "@/lib/settings/shared";

type Cambio = { role: UserRole; permission: string; granted: boolean };

type Props = {
  roles: UserRole[];
  /** Permisos concedidos hoy, por rol. Viene de la base. */
  matrizInicial: Record<string, string[]>;
};

const clave = (role: UserRole, permission: string) => `${role}:${permission}`;

/**
 * Matriz de permisos editable.
 *
 * Tildar una casilla NO guarda: acumula un cambio pendiente que hay que revisar
 * y confirmar. Es deliberado — un click sin querer sobre una casilla puede
 * abrirle o cerrarle el sistema a todo un rol, y el paso de revisión obliga a
 * leer en palabras lo que se está por hacer.
 *
 * La confirmación es un panel en línea y no un modal: un diálogo hecho a mano
 * con divs rompe el foco por teclado y los lectores de pantalla, y acá no hay
 * ninguna primitiva accesible ya montada en el proyecto.
 */
export function PermissionsMatrix({ roles, matrizInicial }: Props) {
  const router = useRouter();

  const inicial = useMemo(() => {
    const set = new Set<string>();
    for (const role of roles) {
      for (const permiso of matrizInicial[role] ?? []) set.add(clave(role, permiso));
    }
    return set;
  }, [roles, matrizInicial]);

  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(inicial));
  const [revisando, setRevisando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const modulos = useMemo(
    () => Array.from(new Set(PERMISSION_CATALOG.map((permission) => permission.module))),
    []
  );

  const cambios = useMemo<Cambio[]>(() => {
    const lista: Cambio[] = [];
    for (const role of roles) {
      for (const permission of PERMISSION_CATALOG) {
        const k = clave(role, permission.key);
        const antes = inicial.has(k);
        const ahora = marcados.has(k);
        if (antes !== ahora) lista.push({ role, permission: permission.key, granted: ahora });
      }
    }
    return lista;
  }, [roles, inicial, marcados]);

  function alternar(role: UserRole, permission: string) {
    setError(null);
    setExito(null);
    setMarcados((previo) => {
      const siguiente = new Set(previo);
      const k = clave(role, permission);
      if (siguiente.has(k)) siguiente.delete(k);
      else siguiente.add(k);
      return siguiente;
    });
  }

  function descartar() {
    setMarcados(new Set(inicial));
    setRevisando(false);
    setError(null);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/settings?action=role-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-permissions", changes: cambios })
      });
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setError(cuerpo?.error ?? "No se pudo guardar. Probá de nuevo.");
        return;
      }
      setRevisando(false);
      setExito(
        `${cambios.length} ${cambios.length === 1 ? "cambio aplicado" : "cambios aplicados"}. Ya rigen para todas las cuentas del rol.`
      );
      router.refresh();
    } catch {
      setError("No se pudo contactar al servidor. Revisá la conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const hayCambios = cambios.length > 0;

  return (
    <div>
      <section className="surface-panel overflow-hidden">
        <div className="urban-scrollbar overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Matriz de permisos por rol. Cada casilla concede o quita un permiso a todas las cuentas de ese rol.
            </caption>
            <thead>
              <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:border-white/10 dark:text-slate-500">
                <th scope="col" className="px-4 py-3">Permiso</th>
                {roles.map((role) => (
                  <th key={role} scope="col" className="px-3 py-3 text-center">{roleLabels[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map((modulo) => (
                <ModuloFilas
                  key={modulo}
                  modulo={modulo}
                  roles={roles}
                  marcados={marcados}
                  inicial={inicial}
                  deshabilitado={guardando}
                  onToggle={alternar}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div aria-live="polite" className="mt-3">
        {exito ? (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200">
            <Check aria-hidden className="h-4 w-4 shrink-0" />
            {exito}
          </p>
        ) : null}
      </div>

      {hayCambios ? (
        <div className="mt-4 rounded-2xl border border-sky-300 bg-sky-50 p-4 duration-200 ease-out motion-safe:animate-in motion-safe:fade-in dark:border-sky-400/40 dark:bg-sky-400/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">
              {cambios.length} {cambios.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={descartar}
                disabled={guardando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 transition-transform duration-150 ease-out hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.97] disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:text-slate-300 dark:hover:text-white"
              >
                <Undo2 aria-hidden className="h-4 w-4" />
                Descartar
              </button>
              {!revisando ? (
                <button
                  type="button"
                  onClick={() => setRevisando(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f89f6] px-3.5 py-2 text-sm font-bold text-white transition-transform duration-150 ease-out hover:bg-[#0066ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 active:scale-[0.97]"
                >
                  Revisar y guardar
                </button>
              ) : null}
            </div>
          </div>

          {revisando ? (
            <div className="mt-4 border-t border-sky-300/60 pt-4 dark:border-sky-400/30">
              <h3 className="text-sm font-black text-sky-950 dark:text-sky-50">Confirmá los cambios</h3>
              <p className="mt-1 text-xs leading-5 text-sky-900/80 dark:text-sky-100/80">
                Rigen apenas se guardan, para todas las cuentas de cada rol, y quedan asentados en la auditoría.
              </p>
              <ul className="mt-3 space-y-1.5">
                {cambios.map((cambio) => {
                  const permiso = PERMISSION_CATALOG.find((p) => p.key === cambio.permission);
                  return (
                    <li key={clave(cambio.role, cambio.permission)} className="flex items-start gap-2 text-sm">
                      <span
                        aria-hidden
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${
                          cambio.granted
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300"
                        }`}
                      >
                        {cambio.granted ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        <span className="font-bold">{roleLabels[cambio.role]}</span>{" "}
                        {cambio.granted ? "pasa a poder" : "deja de poder"}:{" "}
                        <span className="font-semibold">{permiso?.label ?? cambio.permission}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200"
                >
                  <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1f89f6] px-4 py-2 text-sm font-bold text-white transition-transform duration-150 ease-out hover:bg-[#0066ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 active:scale-[0.97] disabled:opacity-60"
                >
                  {guardando ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ShieldCheck aria-hidden className="h-4 w-4" />}
                  {guardando ? "Guardando…" : "Confirmar y guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setRevisando(false)}
                  disabled={guardando}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-transform duration-150 ease-out hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.97] disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:text-slate-300 dark:hover:text-white"
                >
                  Seguir editando
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ModuloFilas({
  modulo,
  roles,
  marcados,
  inicial,
  deshabilitado,
  onToggle
}: {
  modulo: string;
  roles: UserRole[];
  marcados: Set<string>;
  inicial: Set<string>;
  deshabilitado: boolean;
  onToggle: (role: UserRole, permission: string) => void;
}) {
  const filas = PERMISSION_CATALOG.filter((permission) => permission.module === modulo);

  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.02]">
        <th colSpan={1 + roles.length} scope="colgroup" className="px-4 py-2 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {modulo}
        </th>
      </tr>
      {filas.map((permission) => (
        <tr key={permission.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.03]">
          <td className="px-4 py-2.5">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{permission.label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{permission.description}</p>
          </td>
          {roles.map((role) => {
            const k = clave(role, permission.key);
            const activo = marcados.has(k);
            const modificado = activo !== inicial.has(k);
            return (
              <td key={role} className="px-3 py-2.5 text-center">
                <label className="inline-flex cursor-pointer items-center justify-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={activo}
                    disabled={deshabilitado}
                    onChange={() => onToggle(role, permission.key)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#1f89f6] transition-transform duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-transparent"
                  />
                  <span className="sr-only">
                    {permission.label} para {roleLabels[role]}
                    {modificado ? " (modificado, sin guardar)" : ""}
                  </span>
                  {/* El cambio pendiente no se comunica solo con color: además del
                      punto, va en el texto para lectores de pantalla y se lista
                      entero en el panel de confirmación. */}
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${modificado ? "bg-[#1f89f6]" : "bg-transparent"}`}
                  />
                </label>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
