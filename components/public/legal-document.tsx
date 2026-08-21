"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { LegalSections } from "@/components/public/legal-body";
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

        <div className="mt-10">
          <LegalSections sections={doc.sections} isLight={isLight} />
        </div>

        <PortalFooter isLight={isLight} />
      </div>
    </main>
  );
}
