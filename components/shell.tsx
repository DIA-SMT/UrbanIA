"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Moon, Search, Sun } from "lucide-react";
import { Brand } from "@/components/brand";
import { navItems, sidebarSections } from "@/lib/data";

type ThemeMode = "dark" | "light";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("urbania-theme") === "light" ? "light" : "dark";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("urbania-theme", nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <main
      className={
        theme === "light"
          ? "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(31,137,246,0.14),transparent_34%),#f4f8fc] p-3 text-slate-900 md:p-4"
          : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(31,137,246,0.22),transparent_34%),#06121f] p-3 text-slate-100 md:p-4"
      }
    >
      <div className="mx-auto flex max-w-[1540px] items-start gap-4">
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="mb-4 px-2 pt-2">
            <Brand />
          </div>
          <div className="urban-card urban-lift rounded-lg p-3">
            <Link href="/" className={navClass(pathname, "/")}>Vista general</Link>
            {sidebarSections.map((section) => (
              <div key={section.title} className="mt-5">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.title}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link key={item.label} href={item.href} className={`urban-button flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${isActive(pathname, item.href) ? "bg-sky-400/15 text-sky-100" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="urban-lift mt-6 rounded-md border border-sky-300/20 bg-sky-300/10 p-4">
              <p className="font-semibold text-sky-100">Trazabilidad para decidir mejor</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">Propuestas, normativa, audiencias y aportes ciudadanos en una misma lectura.</p>
              <Link href="/propuestas" className="urban-button mt-4 inline-flex rounded-md bg-civic-blue px-4 py-2 text-sm font-semibold text-white">Ver propuestas</Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-3 flex flex-wrap items-center gap-3 2xl:flex-nowrap">
            <div className="lg:hidden">
              <Brand />
            </div>
            <nav className="hidden flex-1 items-center gap-2 2xl:flex">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className={`urban-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${isActive(pathname, item.href) ? "bg-sky-400/20 text-sky-100" : "text-slate-300 hover:bg-white/5"}`}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="urban-lift ml-auto hidden w-full max-w-xs items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 md:flex">
              <Search className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">Buscar en la plataforma...</span>
            </div>
            <button
              onClick={toggleTheme}
              className="urban-button rounded-md border border-white/10 bg-slate-950/60 p-2"
              aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button className="urban-button rounded-md border border-white/10 bg-slate-950/60 p-2"><Bell className="h-5 w-5" /></button>
            <button className="urban-button hidden items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 md:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-xs text-white">A</span>
              <span className="text-sm font-semibold">Agustin</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </header>
          <nav aria-label="Navegacion principal" className="mb-4 xl:hidden">
            <div className="urban-scrollbar flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/45 p-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`urban-button inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                    isActive(pathname, item.href) ? "bg-sky-400/20 text-sky-100" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          {children}
        </section>
      </div>
    </main>
  );
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("urban-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(pathname: string, href: string) {
  return `urban-button block rounded-md px-3 py-3 text-sm font-semibold transition ${
    isActive(pathname, href)
      ? "bg-sky-400/15 text-sky-100"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;
}
