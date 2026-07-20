import type { LucideIcon } from "lucide-react";

/**
 * Primitivas compartidas de los tableros de la Fabrica de Normas.
 *
 * Antes cada tablero definia su propio Metric (identico, duplicado en dos archivos)
 * y sus FilterRow/FilterChip locales. AGENTS.md pide PageHeader, FilterBar,
 * StatusBadge y MetricCard reutilizables: esto es esa base.
 *
 * Criterio tipografico: font-black queda reservado al h1 de cada pantalla. Aca todo
 * baja a semibold/bold, para que la jerarquia la marque el tamaño y el color y no
 * diez elementos compitiendo en el mismo peso.
 */

/**
 * Tira de indicadores en una sola linea. Reemplaza la grilla de 4 tarjetas, que
 * ocupaba un bloque entero antes de que se viera el contenido.
 */
export function MetricStrip({ items }: { items: { label: string; value: string | number; tone?: "default" | "warn" }[] }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-white/8 bg-white/[0.02] px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <dd className={`text-lg font-bold tabular-nums ${item.tone === "warn" ? "text-amber-200" : "text-white"}`}>
            {item.value}
          </dd>
          <dt className="text-xs font-medium text-slate-400">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ icon: Icon, children, action }: { icon?: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-200">
        {Icon ? <Icon className="h-4 w-4 text-[#1f89f6]" /> : null}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-sky-300/40 bg-sky-300/10 text-sky-100"
          : "border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/** Una fila de filtros con su etiqueta al costado, no arriba: ocupa la mitad. */
export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </div>
  );
}

/** Barra que agrupa varios FilterGroup en una sola banda compacta. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2.5">{children}</div>;
}

/** Autor de un registro. Los previos al guardado de autor no lo tienen. */
export function AuthorLine({ name }: { name: string | null }) {
  return <span className="text-xs text-slate-500">{name ? `Creada por ${name}` : "Autor no registrado"}</span>;
}
