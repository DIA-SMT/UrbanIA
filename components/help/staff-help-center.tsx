import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { staffTools } from "@/components/help/staff-help-content";
import { ToolGuideCard } from "@/components/help/tool-guide-card";

/**
 * Manual operativo del equipo municipal. Componente de servidor a proposito:
 * este contenido solo se renderiza para quien ya paso el guard de la pagina,
 * asi que no viaja al cliente de nadie mas.
 */
export function StaffHelpCenter() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Centro de ayuda</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-slate-900 dark:text-white md:text-3xl">
          Manual del equipo municipal
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          El circuito completo va de los aportes ciudadanos a la Fábrica de Normas, con las audiencias públicas como
          registro del debate, el foro para deliberar y Migue como apoyo transversal. Cada tarjeta explica una
          herramienta paso a paso.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          ¿Buscabas la guía para vecinos?{" "}
          <Link href="/ayuda" className="inline-flex items-center gap-1 font-bold text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">
            Centro de ayuda del portal
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      </header>

      <section aria-label="Guías para el equipo municipal" className="grid gap-4 md:grid-cols-2">
        {staffTools.map((tool) => (
          <ToolGuideCard key={tool.name} tool={tool} />
        ))}
      </section>
    </div>
  );
}
