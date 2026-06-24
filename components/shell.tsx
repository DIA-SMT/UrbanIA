import { Bell, ChevronDown, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { navItems, sidebarSections } from "@/lib/data";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(66,211,146,0.18),transparent_32%),#071118] p-3 text-slate-100 md:p-4">
      <div className="mx-auto flex max-w-[1540px] gap-4 overflow-hidden">
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="mb-4 px-2 pt-2">
            <Brand />
          </div>
          <div className="urban-card rounded-lg p-3">
            <div className="rounded-md bg-emerald-400/15 px-3 py-3 text-sm font-semibold text-emerald-100">Vista general</div>
            {sidebarSections.map((section) => (
              <div key={section.title} className="mt-5">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.title}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <button key={item.label} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-6 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="font-semibold text-emerald-100">Construyamos juntos la ciudad que queremos</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">Tu opinion es fundamental para tomar mejores decisiones.</p>
              <button className="mt-4 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-civic-ink">Participar ahora</button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-4 flex flex-wrap items-center gap-3 2xl:flex-nowrap">
            <div className="lg:hidden">
              <Brand />
            </div>
            <nav className="hidden flex-1 items-center gap-2 2xl:flex">
              {navItems.map((item, index) => (
                <button key={item.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${index === 0 ? "bg-emerald-400/20 text-emerald-100" : "text-slate-300 hover:bg-white/5"}`}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="ml-auto hidden w-full max-w-xs items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 md:flex">
              <Search className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">Buscar en la plataforma...</span>
            </div>
            <button className="rounded-md border border-white/10 bg-slate-950/60 p-2"><Bell className="h-5 w-5" /></button>
            <button className="hidden items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 md:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-xs">A</span>
              <span className="text-sm font-semibold">Agustin</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
