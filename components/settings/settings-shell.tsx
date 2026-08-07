"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fingerprint, Inbox, KeyRound, Lock, ScrollText, ShieldCheck, UserCog } from "lucide-react";

const sections = [
  { label: "Usuarios", href: "/admin/configuracion/usuarios", icon: UserCog },
  { label: "Roles", href: "/admin/configuracion/roles", icon: ShieldCheck },
  { label: "Permisos", href: "/admin/configuracion/permisos", icon: KeyRound },
  { label: "Solicitudes", href: "/admin/configuracion/solicitudes", icon: Inbox },
  { label: "Cidituc", href: "/admin/configuracion/cidituc", icon: Fingerprint },
  { label: "Seguridad", href: "/admin/configuracion/seguridad", icon: Lock },
  { label: "Auditoría", href: "/admin/configuracion/auditoria", icon: ScrollText }
];

/** Cabecera común de Configuración: título + navegación entre subsecciones. */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow">Administración del sistema</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">Configuración</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Usuarios, roles, permisos y auditoría de UrbanIA. Las identidades pertenecen a Cidituc; acá se administra qué puede hacer cada cuenta.
        </p>
      </div>
      <nav data-tour="config-nav" aria-label="Secciones de configuración" className="urban-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-white/10 dark:bg-[#0d1b2a]">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors duration-200 ${
                active
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
