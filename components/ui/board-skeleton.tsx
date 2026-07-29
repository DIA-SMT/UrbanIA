/**
 * Skeleton de carga para las secciones (loading.tsx). Aparece al instante al
 * navegar, mientras el server resuelve las queries: el cambio de pantalla se
 * siente inmediato en vez de quedar congelado en la página anterior.
 * Solo divs con pulse: nada de datos, nada de client JS.
 */
export function BoardSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="urban-card rounded-lg p-5 lg:p-7">
        <div className="h-3 w-40 rounded bg-white/10" />
        <div className="mt-3 h-8 w-2/3 max-w-md rounded bg-white/10" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-white/[0.06]" />
        <div className="mt-4 flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-white/[0.06]" />
          <div className="h-10 w-28 rounded-lg bg-white/[0.06]" />
          <div className="h-10 w-28 rounded-lg bg-white/[0.06]" />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="h-6 w-24 rounded-md bg-white/[0.08]" />
              <div className="h-6 w-20 rounded-full bg-white/[0.08]" />
            </div>
            <div className="mt-3 h-5 w-4/5 rounded bg-white/10" />
            <div className="mt-2 h-4 w-3/5 rounded bg-white/[0.06]" />
            <div className="mt-4 border-t border-white/8 pt-3">
              <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
