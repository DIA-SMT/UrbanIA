"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useActiveVoter } from "@/components/normas/active-voter";

/**
 * Apoyo (+1) u objecion (-1) sobre una norma. Un solo componente para el tablero y
 * el detalle: la regla de "clickear el voto activo lo retira" es sutil y no puede
 * vivir duplicada en dos lugares.
 *
 * El voto va por NOMBRE declarado, no por cuenta: varias personas comparten la
 * cuenta institucional y con una clave por cuenta solo podia votar la primera.
 * Sin identidad activa elegida no se puede votar.
 *
 * Los contadores se muestran SIEMPRE, incluso en cero. Ocultarlos cuando no hay
 * votos hacia que la funcion fuera invisible hasta que alguien ya la habia usado,
 * y nadie podia usarla porque no la encontraba.
 */

export type SupportSummary = {
  supportCount: number;
  objectionCount: number;
  net: number;
  voters: { voterName: string; value: number }[];
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
  const router = useRouter();
  const { voter } = useActiveVoter();
  const [summary, setSummary] = useState<SupportSummary>(initial);
  const [voting, setVoting] = useState(false);

  const myValue = voter ? summary.voters.find((entry) => entry.voterName === voter)?.value ?? null : null;
  const enabled = canVote && Boolean(voter);

  async function vote(value: 1 | -1) {
    if (!enabled || voting) return;
    setVoting(true);
    try {
      const removing = myValue === value;
      const response = await fetch(`/api/projects/${normId}/support`, {
        method: removing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(removing ? { voterName: voter } : { value, voterName: voter })
      });
      const payload = await response.json();
      if (response.ok) {
        setSummary(payload);
        onChange?.(payload);
        // Los contadores propios ya se actualizaron, pero el resto de la pantalla
        // sale del servidor (el conteo de devoluciones, el neto de otras cards).
        router.refresh();
      }
    } catch {
      // Sin cambio visible: el estado sigue reflejando lo ultimo confirmado.
    } finally {
      setVoting(false);
    }
  }

  const missingVoter = canVote && !voter;

  return (
    <div className="flex items-center gap-1.5">
      <VoteButton
        tone="support"
        active={myValue === 1}
        count={summary.supportCount}
        disabled={!enabled || voting}
        missingVoter={missingVoter}
        size={size}
        onClick={() => vote(1)}
      />
      <VoteButton
        tone="object"
        active={myValue === -1}
        count={summary.objectionCount}
        disabled={!enabled || voting}
        missingVoter={missingVoter}
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
  missingVoter,
  size,
  onClick
}: {
  tone: "support" | "object";
  active: boolean;
  count: number;
  disabled: boolean;
  missingVoter: boolean;
  size: "sm" | "md";
  onClick: () => void;
}) {
  const Icon = tone === "support" ? ThumbsUp : ThumbsDown;
  const label = tone === "support" ? "A favor" : "En contra";

  /**
   * Verde para el apoyo y rojo para la objecion: el par que ya espera cualquiera.
   * El verde es el acento institucional (#81fc87) y aparece solo aca, en un estado
   * positivo puntual, que es lo que AGENTS.md permite; el azul sigue siendo el
   * color de la interfaz.
   */
  const activeClass =
    tone === "support"
      ? "border-civic-green/50 bg-civic-green/15 text-civic-green shadow-[0_0_0_1px_rgba(129,252,135,0.12),0_4px_14px_-6px_rgba(129,252,135,0.5)]"
      : "border-civic-rose/50 bg-civic-rose/15 text-civic-rose shadow-[0_0_0_1px_rgba(239,91,133,0.12),0_4px_14px_-6px_rgba(239,91,133,0.5)]";

  const idleClass =
    tone === "support"
      ? "border-white/10 bg-white/[0.03] text-slate-400 hover:border-civic-green/35 hover:bg-civic-green/[0.07] hover:text-civic-green"
      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-civic-rose/35 hover:bg-civic-rose/[0.07] hover:text-civic-rose";

  return (
    <button
      type="button"
      onClick={(event) => {
        // El tablero envuelve parte de la card en un Link: sin esto, votar navega.
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={missingVoter ? "Elegí tu nombre arriba para poder votar" : label}
      aria-label={`${label} (${count})`}
      aria-pressed={active}
      className={`group inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs"
      } ${active ? activeClass : idleClass}`}
    >
      <Icon
        className={`transition-transform duration-150 group-hover:-translate-y-px ${
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
        } ${active ? "fill-current" : ""}`}
      />
      {size === "md" ? label : null}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
