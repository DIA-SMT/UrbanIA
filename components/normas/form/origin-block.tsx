"use client";

import { ExternalLink, FileText } from "lucide-react";
import type { ProjectAttachmentView } from "@/lib/projects/shared";

/** Adjuntos que dejan las normas importadas de un PDF. */
const PDF_ORIGEN = "PDF_ORIGEN";

/**
 * Origen de una norma importada: el PDF del que salio y la cita textual que la
 * respalda.
 *
 * Importa que este ARRIBA del formulario: sin esto se formaliza a ciegas. Quien
 * edita necesita ver que dijo realmente la organizacion antes de convertirlo en
 * articulado, sobre todo porque el articulado NO lo escribio la organizacion.
 */
export function OriginBlock({ attachments }: { attachments: ProjectAttachmentView[] }) {
  const origins = attachments.filter((attachment) => attachment.kind === PDF_ORIGEN);
  if (!origins.length) return null;

  return (
    <section className="urban-card rounded-lg border-l-2 border-l-[#f6d500] p-4 lg:p-5">
      <p className="inline-flex items-center gap-2 text-sm font-black text-white">
        <FileText className="h-4 w-4 text-[#1f89f6]" />
        Origen de esta norma
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Vino de un documento aportado a la audiencia. El articulado NO lo redactó la organización: se genera en “Formalizar” y hay que validarlo.
      </p>

      <div className="mt-3 grid gap-2">
        {origins.map((origin) => (
          <div key={origin.id} className="rounded-md border border-white/8 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-slate-200">
                <span className="truncate">{origin.name}</span>
                {origin.sourcePages.length ? (
                  <span className="shrink-0 text-[11px] font-bold text-slate-500">
                    pág. {origin.sourcePages.join(", ")}
                  </span>
                ) : null}
              </span>
              {origin.url ? (
                <a
                  href={origin.url}
                  target="_blank"
                  rel="noreferrer"
                  className="urban-button inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-slate-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir el PDF
                </a>
              ) : null}
            </div>

            {origin.excerpt ? (
              <p className="mt-2 border-l-2 border-[#f6d500] pl-2 text-xs italic leading-5 text-slate-300">
                “{origin.excerpt}”
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
