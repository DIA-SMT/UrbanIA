"use client";

import { useState } from "react";
import { BookOpen, MessagesSquare } from "lucide-react";
import { CpuChatWorkspace } from "@/components/cpu/cpu-chat-workspace";
import { NormativeExplorer, type NormativeFocusRequest } from "@/components/normative/normative-explorer";
import type { NormativeExplorerData } from "@/lib/normative/data";

type Tab = "consulta" | "articulos";

export function CpuConsultation({ data }: { data: NormativeExplorerData }) {
  const [tab, setTab] = useState<Tab>("consulta");
  const [focusRequest, setFocusRequest] = useState<NormativeFocusRequest | null>(null);

  function openArticle(articleNumber: string) {
    setTab("articulos");
    setFocusRequest((current) => ({ number: articleNumber, nonce: (current?.nonce ?? 0) + 1 }));
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow">Asistente normativo</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white md:text-4xl">
              Consulta al Código de Planeamiento Urbano
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              Preguntá en lenguaje natural y obtené respuestas fundamentadas en los artículos reales del CPU, con enlaces directos a cada artículo citado.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <strong className="block">Fuente normativa · texto ordenado a mayo de 2014</strong>
            <span className="mt-1 block opacity-80">Ordenanza N.º {data.document.ordinanceNumber} · vigencia posterior no verificada</span>
          </div>
        </div>

        <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#0d1b2a]">
          <TabButton active={tab === "consulta"} onClick={() => setTab("consulta")} icon={MessagesSquare} label="Consulta" />
          <TabButton active={tab === "articulos"} onClick={() => setTab("articulos")} icon={BookOpen} label="Artículos del Código" />
        </div>
      </header>

      <div className={tab === "consulta" ? "" : "hidden"}>
        <CpuChatWorkspace onOpenArticle={openArticle} />
      </div>
      {tab === "articulos" ? <NormativeExplorer data={data} focusRequest={focusRequest} /> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-[#1f89f6] text-white shadow-[0_8px_24px_rgba(31,137,246,0.22)]"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
