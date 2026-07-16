"use client";

import { useEffect, useRef, useState } from "react";
import { NormativeRelationshipType } from "@prisma/client";
import { Anchor, Loader2, Search, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { relationshipTypeLabels, relationshipTypeStyles, type ProjectAnchorView } from "@/lib/projects/shared";

type SearchResult = { id: string; number: string; title: string; excerpt: string; documentTitle: string; score: number };

export function NormativeAnchorBlock({
  projectId,
  ensureDraft,
  anchors,
  onChange
}: {
  projectId: string | null;
  ensureDraft: () => Promise<string | null>;
  anchors: ProjectAnchorView[];
  onChange: (anchors: ProjectAnchorView[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [relationship, setRelationship] = useState<NormativeRelationshipType>("APPLIES");
  const [note, setNote] = useState("");
  const [anchoringId, setAnchoringId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/normativa/search?q=${encodeURIComponent(query.trim())}`);
        const payload = await response.json();
        setResults(Array.isArray(payload.articles) ? payload.articles : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const anchoredKeys = new Set(anchors.map((anchor) => `${anchor.articleId}-${anchor.relationshipType}`));

  async function anchor(result: SearchResult) {
    setError("");
    const id = projectId ?? (await ensureDraft());
    if (!id) {
      setError("Carga titulo y descripcion (40+ caracteres) para poder anclar.");
      return;
    }
    setAnchoringId(result.id);
    try {
      const response = await fetch("/api/normativa/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: result.id, sourceType: "project", sourceId: id, relationshipType: relationship, notes: note.trim() || undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "No se pudo anclar el articulo.");
      const newAnchor: ProjectAnchorView = {
        id: payload.id,
        articleId: result.id,
        articleNumber: result.number,
        articleTitle: result.title,
        relationshipType: relationship,
        notes: note.trim() || null
      };
      const filtered = anchors.filter((entry) => !(entry.articleId === result.id && entry.relationshipType === relationship));
      onChange([...filtered, newAnchor]);
      setNote("");
    } catch (anchorError) {
      setError(anchorError instanceof Error ? anchorError.message : "No se pudo anclar el articulo.");
    } finally {
      setAnchoringId(null);
    }
  }

  async function remove(anchorId: string) {
    onChange(anchors.filter((entry) => entry.id !== anchorId));
    try {
      await fetch(`/api/normativa/links?id=${anchorId}`, { method: "DELETE" });
    } catch {
      // El anclaje ya se quito de la UI; el error de red no bloquea.
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-300">Normativa de referencia</p>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-black text-sky-200">
          <Anchor className="h-3.5 w-3.5" />
          {anchors.length} anclados
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar articulo, tema u ordenanza (ej. altura, 29, Ordenanza 2648)..."
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
          {searching ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
        </label>
        <select
          value={relationship}
          onChange={(event) => setRelationship(event.target.value as NormativeRelationshipType)}
          className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/50"
        >
          {(Object.keys(relationshipTypeLabels) as NormativeRelationshipType[]).map((value) => (
            <option key={value} value={value}>{relationshipTypeLabels[value]}</option>
          ))}
        </select>
      </div>
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Nota opcional del anclaje (por que anclas este articulo)..."
        className="mt-2 h-10 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-300/50"
      />

      {results.length ? (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-white/10 bg-slate-950/40 p-2">
          {results.map((result) => {
            const already = anchoredKeys.has(`${result.id}-${relationship}`);
            return (
              <button
                key={result.id}
                type="button"
                onClick={() => anchor(result)}
                disabled={already || anchoringId === result.id}
                className="flex w-full items-start gap-3 rounded-md border border-white/8 bg-white/[0.02] p-2.5 text-left transition hover:border-sky-300/30 disabled:opacity-50"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-400/10 text-xs font-black text-sky-200">{result.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-200">{result.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{result.excerpt}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-sky-300">{already ? "Anclado" : anchoringId === result.id ? "..." : "Anclar"}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-bold text-amber-200">{error}</p> : null}

      <div className="mt-4">
        {anchors.length ? (
          <div className="grid gap-2">
            {anchors.map((anchorItem) => (
              <div key={anchorItem.id} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-400/10 text-xs font-black text-sky-200">{anchorItem.articleNumber}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-200">{anchorItem.articleTitle}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${relationshipTypeStyles[anchorItem.relationshipType]}`}>{relationshipTypeLabels[anchorItem.relationshipType]}</span>
                  </div>
                  {anchorItem.notes ? <p className="mt-1 text-xs leading-5 text-slate-400">{anchorItem.notes}</p> : null}
                </div>
                <button type="button" onClick={() => remove(anchorItem.id)} className="shrink-0 text-slate-500 hover:text-rose-300" title="Quitar anclaje">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Anchor}
            title="Todavia no anclaste normativa"
            description="Ancla articulos para que el diagnostico use su texto exacto en vez de una interpretacion."
          />
        )}
      </div>
    </div>
  );
}
