import { Bot, CheckCircle2, Sparkles } from "lucide-react";

export function MigueCard() {
  return (
    <aside className="urban-card urban-lift overflow-hidden rounded-lg">
      <div className="grid gap-0 sm:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-1">
        <div className="relative min-h-56 bg-[radial-gradient(circle_at_center,rgba(31,137,246,0.18),transparent_62%)]">
          <img
            src="/migue/migue-assistant-transparent.png"
            alt="Migue, asistente urbano de UrbanIA"
            className="absolute bottom-0 left-1/2 h-56 -translate-x-1/2 object-contain sm:h-60 lg:h-64"
          />
        </div>

        <div className="p-4">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-sky-200">
            <Bot className="h-4 w-4" />
            Copiloto urbano
          </div>
          <h2 className="text-2xl font-black leading-tight text-white">Migue</h2>
          <p className="mt-1 text-sm font-bold text-civic-sky">Asistente urbano de UrbanIA</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Te entiendo en lenguaje natural para ordenar propuestas, audiencias, documentos y decisiones con trazabilidad.
          </p>

          <div className="mt-4 grid gap-2">
            {["Lenguaje natural", "Audiencias y documentos", "Informes para validar"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-sky-300" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-sky-300/20 bg-sky-300/10 p-3">
            <p className="flex items-center gap-2 text-sm font-black text-sky-100">
              <Sparkles className="h-4 w-4" />
              Hola, soy Migue.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Contame que queres mejorar, revisar o resumir, aunque venga desordenado.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
