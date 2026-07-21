"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * Apoyo (+1) u objecion (-1) sobre una norma. Un solo componente para el tablero y
 * el detalle: la regla de "clickear el voto activo lo retira" es sutil y no puede
 * vivir duplicada en dos lugares.
 *
 * Los contadores se muestran SIEMPRE, incluso en cero. Ocultarlos cuando no hay
 * votos hacia que la funcion fuera invisible hasta que alguien ya la habia usado,
 * y nadie podia usarla porque no la encontraba.
 */

export type SupportSummary = {
  supportCount: number;
  objectionCount: number;
  net: number;
  myValue: 1 | -1 | null;
};

export function SupportControls({
  normId,
  initial,
  canVote,
  size = "md",
  onChange
}: {
  normId: string;
  initial: SupportSummary;
  canVote: boolean;
  size?: "sm" | "md";
  onChange?: (summary: SupportSummary) => void;
}) {
  const [summary, setSummary] = useState<SupportSummary>(initial);
  const [voting, setVoting] = useState(false);

  async function vote(value: 1 | -1) {
    if (!canVote || voting) return;
    setVoting(true);
    try {
      const removing = summary.myValue === value;
      const response = await fetch(`/api/projects/${normId}/support`, {
        method: removing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(removing ? {} : { body: JSON.stringify({ value }) })
      });
      const payload = await response.json();
      if (response.ok) {
        setSummary(payload);
        onChange?.(payload);
      }
    } catch {
      // Sin cambio visible: el estado sigue reflejando lo ultimo confirmado.
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <VoteButton
        tone="support"
        active={summary.myValue === 1}
        count={summary.supportCount}
        disabled={!canVote || voting}
        size={size}
        onClick={() => vote(1)}
      />
      <VoteButton
        tone="object"
        active={summary.myValue === -1}
        count={summary.objectionCount}
        disabled={!canVote || voting}
        size={size}
        onClick={() => vote(-1)}
      />
    </div>
  );
}

function VoteButton({
  tone,
  active,
  count,
  disabled,
  size,
  onClick
}: {
  tone: "support" | "object";
  active: boolean;
  count: number;
  disabled: boolean;
  size: "sm" | "md";
  onClick: () => void;
}) {
  const Icon = tone === "support" ? ThumbsUp : ThumbsDown;
  const activeClass =
    tone === "support" ? "border-sky-300/40 bg-sky-300/10 text-sky-100" : "border-rose-300/40 bg-rose-300/10 text-rose-100";
  const label = tone === "support" ? "A favor" : "En contra";

  return (
    <button
      type="button"
      onClick={(event) => {
        // El tablero envuelve la card en un Link: sin esto, votar navega.
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={label}
      aria-label={`${label} (${count})`}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold transition disabled:opacity-40 ${
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${active ? activeClass : "border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200"}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {size === "md" ? label : null}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
