import type { ReactNode } from "react";

type EmptyStateIcon = React.ComponentType<{ className?: string }>;

/**
 * Estado vacio reutilizable (pedido por AGENTS.md). Sirve para listas sin datos
 * o paneles sin contenido. `action` puede ser un boton, un link o cualquier CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: EmptyStateIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-300/70 p-8 text-center dark:border-white/15">
      <div className="max-w-md">
        <Icon className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600" />
        <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">{title}</p>
        {description ? <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
