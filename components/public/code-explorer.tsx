"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpenCheck, ChevronRight, FileText, Loader2, Search } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import {
  PortalFooter,
  PortalHeader,
  bodyTextClass,
  cardClass,
  eyebrowClass,
  pageClass,
  panelClass,
  searchInputClass,
  searchWrapClass,
  sectionTitleClass,
  usePortalTheme
} from "@/components/public/portal-chrome";
import { CPU_TOPICS } from "@/lib/citizen/contributions";

type ArticleHeader = { number: string; title: string };
type Chapter = { id: string; number: string; title: string; articles: ArticleHeader[] };

type CodeExplorerProps = {
  chapters: Chapter[];
  documentTitle: string;
  ordinanceNumber: string;
  versionLabel: string;
  articleCount: number;
};

type SearchHit = { number: string; title: string; chapterId: string | null; excerpt: string };
type OpenArticle = { number: string; title: string; content: string };

/** Título del capítulo en mayúsculas: se ve mejor en capitalizado. */
function prettyTitle(value: string) {
  const lower = value.toLocaleLowerCase("es-AR");
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
}

export function CodeExplorer({ chapters, documentTitle, ordinanceNumber, versionLabel, articleCount }: CodeExplorerProps) {
  const { isLight, toggleTheme } = usePortalTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const [article, setArticle] = useState<OpenArticle | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [articleError, setArticleError] = useState("");
  const requestRef = useRef(0);

  const openChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === openChapterId) ?? null,
    [chapters, openChapterId]
  );

  // Búsqueda con debounce contra el mismo motor que usa la Consulta al CPU.
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setHits(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const ticket = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/normativa/articulos?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
        const data = (await response.json()) as { results?: SearchHit[] };

        // Descarta respuestas de búsquedas viejas que llegan tarde.
        if (ticket === requestRef.current) {
          setHits(data.results ?? []);
        }
      } catch {
        if (ticket === requestRef.current) {
          setHits([]);
        }
      } finally {
        if (ticket === requestRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function openArticle(number: string) {
    setIsLoadingArticle(true);
    setArticleError("");
    setArticle(null);

    try {
      const response = await fetch(`/api/normativa/articulos?number=${encodeURIComponent(number)}`, { cache: "no-store" });
      const data = (await response.json()) as { article?: OpenArticle; error?: string };

      if (!response.ok || !data.article) {
        throw new Error(data.error ?? "No pudimos abrir el articulo.");
      }

      setArticle(data.article);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setArticleError(error instanceof Error ? error.message : "No pudimos abrir el articulo.");
    } finally {
      setIsLoadingArticle(false);
    }
  }

  // Vista de artículo abierto: ocupa la pantalla, con vuelta atrás.
  if (article || isLoadingArticle || articleError) {
    return (
      <main className={pageClass(isLight)}>
        <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="codigo" />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <button
            onClick={() => {
              setArticle(null);
              setArticleError("");
            }}
            className={`mb-6 inline-flex items-center gap-2 text-sm font-semibold ${isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al codigo
          </button>

          {isLoadingArticle ? (
            <div className={`${panelClass(isLight)} flex items-center gap-3 text-sm`}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Abriendo articulo...
            </div>
          ) : articleError ? (
            <div className={isLight ? "rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-900" : "rounded-2xl border border-amber-300/25 bg-amber-300/10 p-6 text-sm font-medium text-amber-100"}>
              {articleError}
            </div>
          ) : article ? (
            <article className={panelClass(isLight)}>
              <div className={eyebrowClass(isLight)}>
                <FileText className="h-3.5 w-3.5" />
                Articulo {article.number}
              </div>
              <h1 className={sectionTitleClass(isLight)}>{prettyTitle(article.title)}</h1>
              <div className={`mt-6 whitespace-pre-line text-sm leading-7 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {article.content}
              </div>
              <p className={`mt-8 border-t pt-4 text-xs leading-5 ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"}`}>
                Texto ordenado a {versionLabel}. Su vigencia posterior no esta verificada: la validacion legal la hace el equipo municipal.
              </p>
            </article>
          ) : null}
        </div>
        <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
      </main>
    );
  }

  return (
    <main className={pageClass(isLight)}>
      <PortalHeader isLight={isLight} onToggleTheme={toggleTheme} active="codigo" />

      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className={eyebrowClass(isLight)}>
          <BookOpenCheck className="h-3.5 w-3.5" />
          {ordinanceNumber ? `Ordenanza ${ordinanceNumber}` : "Archivo digital"}
        </div>
        <h1 className={`mt-4 font-display text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem] ${isLight ? "text-slate-900" : "text-white"}`}>
          {documentTitle}
        </h1>
        <p className={`mt-4 max-w-2xl text-sm leading-7 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          {chapters.length} capitulos y {articleCount} articulos. Buscá un tema o entrá por capitulo para leer el texto completo.
        </p>

        <div className="mt-8 max-w-xl">
          <label className="block">
            <span className="sr-only">Buscar en el codigo</span>
            <span className={searchWrapClass(isLight)}>
              {isSearching ? (
                <Loader2 className={isLight ? "h-4 w-4 animate-spin text-slate-400" : "h-4 w-4 animate-spin text-slate-500"} />
              ) : (
                <Search className={isLight ? "h-4 w-4 text-slate-400" : "h-4 w-4 text-slate-500"} />
              )}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar: altura, distrito R1, retiro, usos del suelo..."
                className={searchInputClass(isLight)}
              />
            </span>
          </label>
        </div>

        {hits ? (
          <section className="mt-8">
            <h2 className={`font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
              {hits.length ? `${hits.length} articulos encontrados` : "Sin resultados"}
            </h2>
            {hits.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {hits.map((hit) => (
                  <button key={hit.number} onClick={() => openArticle(hit.number)} className={cardClass(isLight)}>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`}>
                      Articulo {hit.number}
                    </span>
                    <span className={`mt-2 block font-display text-base font-bold leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                      {prettyTitle(hit.title)}
                    </span>
                    <span className={`mt-2 block text-xs leading-5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      {hit.excerpt}…
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={bodyTextClass(isLight)}>
                No encontramos articulos con esos terminos. Probá con otra palabra, o preguntale a Migue: te responde citando el articulo.
              </p>
            )}
          </section>
        ) : openChapter ? (
          <section className="mt-8">
            <button
              onClick={() => setOpenChapterId(null)}
              className={`mb-5 inline-flex items-center gap-2 text-sm font-semibold ${isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Todos los capitulos
            </button>
            <div className={eyebrowClass(isLight)}>Capitulo {openChapter.number}</div>
            <h2 className={sectionTitleClass(isLight)}>{prettyTitle(openChapter.title)}</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {openChapter.articles.map((item) => (
                <button key={item.number} onClick={() => openArticle(item.number)} className={cardClass(isLight)}>
                  <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`}>
                    Articulo {item.number}
                  </span>
                  <span className={`mt-2 block font-display text-base font-bold leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                    {prettyTitle(item.title)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="mt-10">
              <h2 className={`font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>Por tema</h2>
              <p className={bodyTextClass(isLight)}>Los temas que el Codigo efectivamente regula.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {CPU_TOPICS.map((topic) => {
                  const topicChapters = chapters.filter((chapter) => topic.chapters.includes(chapter.number));
                  const count = topicChapters.reduce((sum, chapter) => sum + chapter.articles.length, 0);

                  return (
                    <button
                      key={topic.id}
                      onClick={() => setOpenChapterId(topicChapters[0]?.id ?? null)}
                      className={cardClass(isLight)}
                    >
                      <span className={`block font-display text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {topic.label}
                      </span>
                      <span className={`mt-1.5 block text-xs leading-5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        {topic.summary}
                      </span>
                      <span className={`mt-3 block text-[11px] font-semibold ${isLight ? "text-civic-blue-deep" : "text-sky-300"}`}>
                        Capitulo {topic.chapters.join(" y ")} · {count} articulos
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-10">
              <h2 className={`font-display text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>Todos los capitulos</h2>
              <div className="mt-4 grid gap-2">
                {chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    onClick={() => setOpenChapterId(chapter.id)}
                    className={`${cardClass(isLight)} flex items-center gap-4`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${isLight ? "bg-slate-100 text-slate-600" : "bg-white/[0.06] text-slate-300"}`}>
                      {chapter.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-display text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {prettyTitle(chapter.title)}
                      </span>
                      <span className={`mt-0.5 block text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        {chapter.articles.length} articulos
                      </span>
                    </span>
                    <ChevronRight className={isLight ? "h-4 w-4 shrink-0 text-slate-400" : "h-4 w-4 shrink-0 text-slate-500"} />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <PortalFooter isLight={isLight} />
      </div>

      <MigueFloatingChat appearance={isLight ? "light" : "dark"} />
    </main>
  );
}
