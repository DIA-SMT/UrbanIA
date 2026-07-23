import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

/** Placeholder de las pantallas de creacion/carga (Etapas 2 y 3). */
export function StageStub({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-4">
      <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-sky-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Audiencias públicas
      </Link>
      <section className="urban-card mx-auto max-w-2xl rounded-lg p-6 text-center lg:p-10">
        <Construction className="mx-auto h-8 w-8 text-[#1f89f6]" />
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-sky-300">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">{description}</p>
        <Link href="/audiencias" className="urban-button mt-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Volver al registro
        </Link>
      </section>
    </div>
  );
}
