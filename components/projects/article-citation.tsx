import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { ProjectCitedArticle } from "@/lib/projects/shared";

/**
 * Cita de un articulo normativo usado por el diagnostico: numero + fragmento
 * textual resaltado, con link al explorador normativo. Referencia visual de
 * source-citation.tsx, pero para el contrato citedArticles[{ articleId, articleNumber, quote }].
 */
export function ArticleCitation({ citation, title }: { citation: ProjectCitedArticle; title?: string | null }) {
  return (
    <Link
      href={`/consulta-cpu#articulo-${citation.articleNumber}`}
      className="block rounded-xl border border-sky-200 bg-sky-50 p-3 transition hover:border-sky-300 dark:border-sky-400/25 dark:bg-sky-400/10"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
          <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <span className="truncate">Articulo {citation.articleNumber}{title ? ` — ${title}` : ""}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <p className="mt-2 border-l-2 border-[#f6d500] pl-3 text-[13px] italic leading-6 text-slate-600 dark:text-slate-300">
        “{citation.quote}”
      </p>
    </Link>
  );
}
