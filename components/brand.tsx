import { Building2 } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-end justify-center rounded-md border border-emerald-300/30 bg-emerald-400/10 p-2 shadow-glow">
        <Building2 className="h-7 w-7 text-civic-mint" />
      </div>
      <div>
        <p className="text-xl font-black leading-none tracking-normal text-white">UrbanIA</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">Deliberacion urbana</p>
      </div>
    </div>
  );
}
