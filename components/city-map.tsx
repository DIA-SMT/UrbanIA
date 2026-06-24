import { Bike, Building2, Bus, Layers3, Search, Trees, Users } from "lucide-react";
import { metrics } from "@/lib/data";
import type { DashboardMetric } from "@/lib/dashboard/data";

const pins = [
  { icon: Building2, label: "Normativa", className: "left-[50%] top-[24%] bg-violet-500" },
  { icon: Trees, label: "Espacios verdes", className: "left-[70%] top-[31%] bg-emerald-500" },
  { icon: Bus, label: "Transporte", className: "left-[85%] top-[48%] bg-amber-500" },
  { icon: Users, label: "Participacion", className: "left-[52%] top-[63%] bg-rose-500" },
  { icon: Bike, label: "Movilidad", className: "left-[79%] top-[70%] bg-sky-500" }
];

export function CityMap({ dashboardMetrics = metrics }: { dashboardMetrics?: DashboardMetric[] }) {
  return (
    <section className="urban-card relative min-h-[430px] overflow-hidden rounded-lg">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(11,37,48,0.92),rgba(17,24,39,0.48)),url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center" />
      <div className="absolute inset-0 map-grid opacity-25" />
      <div className="relative z-10 grid min-h-[430px] grid-cols-1 lg:grid-cols-[340px_1fr]">
        <div className="m-4 rounded-lg md:m-5 border border-white/10 bg-slate-950/62 p-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black leading-tight text-white">San Miguel de Tucuman</h1>
            <span className="text-amber-300">21 C</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Explora, simula y participa en el planeamiento urbano con datos, normativa e inteligencia artificial.</p>
          <div className="mt-5 flex items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-400">
            <span className="flex-1">Buscar lugares, normativas, proyectos...</span>
            <Search className="h-4 w-4" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {dashboardMetrics.map((metric) => (
              <div key={metric.label} className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-2xl font-black leading-tight text-civic-mint">{metric.value}</p>
                <p className="mt-2 text-xs leading-4 text-slate-300">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[260px]">
          <div className="absolute right-5 top-5 flex gap-2">
            {["2D", "3D"].map((item) => (
              <button key={item} className={`rounded-md px-3 py-2 text-sm font-semibold ${item === "3D" ? "bg-cyan-400/20 text-cyan-100" : "bg-slate-950/70 text-slate-300"}`}>{item}</button>
            ))}
            <button className="rounded-md bg-slate-950/70 p-2"><Layers3 className="h-5 w-5" /></button>
          </div>
          {pins.map((pin) => (
            <div key={pin.label} className={`absolute grid h-12 w-12 md:h-14 md:w-14 place-items-center rounded-full border-4 border-white/75 text-white shadow-glow ${pin.className}`}>
              <pin.icon className="h-6 w-6 md:h-7 md:w-7" />
            </div>
          ))}
          <div className="absolute bottom-5 left-1/2 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap justify-center gap-2 rounded-md border border-white/10 bg-slate-950/72 p-2 backdrop-blur">
            {["Transporte", "Espacios verdes", "Equipamiento", "Zonificacion", "Riesgos"].map((layer) => (
              <span key={layer} className="rounded-md bg-white/7 px-3 py-2 text-xs font-semibold text-slate-200">{layer}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
