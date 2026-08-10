import { Fingerprint, Inbox } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/components/settings/format";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { ciditucIntegrationStatus } from "@/lib/auth/identity/cidituc";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitudes de acceso | Configuración | UrbanIA"
};

const requestStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada"
};

export default async function SolicitudesPage() {
  await requireSettingsAccess("users.manage");
  const cidituc = ciditucIntegrationStatus();
  const requests = await prisma.accessRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Solicitudes de acceso</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pedidos de ingreso al sistema interno de personas ya identificadas en Cidituc, a la espera de que un administrador les asigne rol.
        </p>
      </div>

      {!cidituc.enabled ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/30 dark:bg-sky-400/10">
          <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-[#1f89f6] dark:text-sky-200" />
          <div>
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">La bandeja se activa con la integración Cidituc</p>
            <p className="mt-1 text-xs leading-5 text-sky-800/80 dark:text-sky-200/80">
              La estructura ya está lista: cuando la integración esté operativa, cada persona validada en Cidituc que pida acceso aparecerá acá para aprobarse o rechazarse.{" "}
              <Link href="/admin/configuracion/cidituc" className="font-bold underline decoration-sky-400 underline-offset-2">Ver estado de la integración</Link>.
            </p>
          </div>
        </div>
      ) : null}

      <section className="surface-panel overflow-hidden">
        {requests.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
              <Inbox className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">No hay solicitudes pendientes</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-400 dark:text-slate-500">
              Cuando alguien solicite acceso al sistema interno, va a aparecer en esta bandeja con su identidad Cidituc verificada.
            </p>
          </div>
        ) : (
          <div className="urban-scrollbar overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:border-white/10 dark:text-slate-500">
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-3 py-3">Correo</th>
                  <th scope="col" className="px-3 py-3">DNI</th>
                  <th scope="col" className="px-3 py-3">Fecha</th>
                  <th scope="col" className="px-3 py-3">Estado Cidituc</th>
                  <th scope="col" className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{request.firstName} {request.lastName}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{request.email}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{request.dni}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(request.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{request.ciditucStatus ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{requestStatusLabels[request.status] ?? request.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
