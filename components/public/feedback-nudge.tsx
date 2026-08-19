import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

/**
 * Invitacion a dejar una recomendacion sobre UrbanIA. Se pone en cualquier
 * pantalla del portal donde alguien pueda chocarse con la herramienta.
 *
 * El texto habla del PORTAL, nunca de la pantalla donde esta puesto. Si dijera
 * "conta como te fue presentando tu aporte", la persona entiende que solo se
 * puede opinar del formulario, y lo que se quiere saber es cualquier cosa: que
 * el buscador del Codigo no encuentra, que en el telefono no se lee, lo que sea.
 */
export function FeedbackNudge({
  isLight,
  variant = "panel"
}: {
  isLight: boolean;
  /** "panel" para una columna lateral; "linea" para cerrar una pantalla a lo ancho. */
  variant?: "panel" | "linea";
}) {
  if (variant === "linea") {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
          isLight ? "border-slate-200 bg-slate-50/70" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <Lightbulb className={`h-4 w-4 shrink-0 ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`} />
        <p className={`min-w-[200px] flex-1 text-xs leading-5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          ¿Algo de UrbanIA no funcionó o se te ocurre cómo mejorarlo? Contanos: lo lee el equipo que la desarrolla.
        </p>
        <Link
          href="/sugerencias"
          className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-bold ${
            isLight ? "text-civic-blue-deep" : "text-sky-300"
          }`}
        >
          Dejar una recomendación
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        isLight ? "border-slate-200 bg-slate-50/70" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-2">
        <Lightbulb className={`h-4 w-4 ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`} />
        <p className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>¿Cómo te resulta el portal?</p>
      </div>
      <p className={`mt-1.5 text-xs leading-5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
        Si algo no funcionó, no se entendió o se te ocurre cómo mejorarlo, contanos. Es sobre la herramienta, no sobre
        la ciudad.
      </p>
      <Link
        href="/sugerencias"
        className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold ${
          isLight ? "text-civic-blue-deep" : "text-sky-300"
        }`}
      >
        Dejar una recomendación
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
