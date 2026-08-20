"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import {
  PortalFooter,
  PortalHeader,
  eyebrowClass,
  pageClass,
  usePortalTheme
} from "@/components/public/portal-chrome";
import { LEGAL_BETA_NOTICE, LEGAL_UPDATED_AT, LEGAL_VERSION, type LegalDocument } from "@/lib/legal/content";

/**
 * Renderiza la Política de Privacidad y los Términos de Uso. Los dos usan el
 * mismo armazón para que se lean igual y el texto viva en un solo lugar
 * (lib/legal/content.ts), que es lo que el área legal va a corregir.
 *
 * Queda ABIERTO sin sesión, igual que la portada y la ayuda: alguien tiene que
 * poder leer a qué se compromete ANTES de entregar su DNI, no después.
 */
export function LegalDocumentPage({ document: doc }: { document: LegalDocument }) {
  const { isLight, toggleTheme } = usePortalTheme();

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} />

      <div className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <Link
          href="/"
          className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
            isLight ? "text-slate-500 hover:text-sky-700" : "text-slate-400 hover:text-sky-200"
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al portal
        </Link>

        <header className="mt-5">
          <div className={eyebrowClass(isLight)}>
            <FlaskConical className="h-3.5 w-3.5" />
            Versión beta
          </div>
          <h1
            className={`mt-3 font-display text-[2rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[2.5rem] ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {doc.title}
          </h1>
          <p className={`mt-2 text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-500"}`}>
            Versión {LEGAL_VERSION} · Última actualización: {LEGAL_UPDATED_AT}
          </p>
          <p className={`mt-4 text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-300"}`}>{doc.intro}</p>
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-6 ${
              isLight
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-amber-300/25 bg-amber-300/10 text-amber-100"
            }`}
          >
            {LEGAL_BETA_NOTICE}
          </p>
        </header>

        <div className="mt-10 space-y-9">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2
                className={`font-display text-lg font-extrabold tracking-[-0.01em] ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {renderBody(section.body, isLight)}
              </div>
            </section>
          ))}
        </div>

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}

/**
 * Agrupa las líneas que empiezan con "- " en una sola lista y deja el resto como
 * párrafos. Sin esto, cada ítem sería un párrafo suelto y una enumeración de
 * cinco proveedores se leería como cinco frases sin relación.
 */
function renderBody(body: string[], isLight: boolean) {
  const bloques: { tipo: "parrafo" | "lista"; lineas: string[] }[] = [];

  for (const linea of body) {
    const esItem = linea.startsWith("- ");
    const ultimo = bloques[bloques.length - 1];
    if (esItem && ultimo?.tipo === "lista") {
      ultimo.lineas.push(linea.slice(2));
    } else {
      bloques.push({ tipo: esItem ? "lista" : "parrafo", lineas: [esItem ? linea.slice(2) : linea] });
    }
  }

  const textoClase = `text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-300"}`;

  return bloques.map((bloque, indice) =>
    bloque.tipo === "lista" ? (
      <ul key={indice} className="space-y-2">
        {bloque.lineas.map((linea, i) => (
          <li key={i} className={`relative pl-5 ${textoClase}`}>
            <span
              aria-hidden
              className={`absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full ${
                isLight ? "bg-civic-blue-deep" : "bg-sky-300"
              }`}
            />
            <Resaltado texto={linea} isLight={isLight} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={indice} className={textoClase}>
        <Resaltado texto={bloque.lineas[0]} isLight={isLight} />
      </p>
    )
  );
}

/**
 * Resalta los marcadores `[[...]]` de lo que el municipio todavía no definió.
 * Se muestran a propósito y en amarillo: si alguien publica el documento sin
 * completarlos, tiene que saltar a la vista en vez de pasar por texto normal.
 */
function Resaltado({ texto, isLight }: { texto: string; isLight: boolean }) {
  const partes = texto.split(/(\[\[[^\]]+\]\])/g);

  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith("[[") && parte.endsWith("]]") ? (
          <mark
            key={i}
            className={`rounded px-1 font-semibold ${
              isLight ? "bg-amber-100 text-amber-900" : "bg-amber-300/20 text-amber-100"
            }`}
            title="Pendiente de definición por el municipio"
          >
            {parte.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{parte}</span>
        )
      )}
    </>
  );
}
