"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogIn, Moon, Sun } from "lucide-react";

/**
 * Chrome y sistema visual del portal ciudadano, compartido por la landing, el
 * explorador del Código y la pantalla de aportes. Vive acá para que las tres
 * pantallas no se desincronicen.
 */

export type ThemeMode = "dark" | "light";

const THEME_KEY = "urbania-portal-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("urban-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

export function usePortalTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    setTheme(saved);
    applyTheme(saved);

    return () => {
      document.documentElement.classList.remove("urban-light");
      document.documentElement.style.colorScheme = "light";
    };
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return { theme, isLight: theme === "light", toggleTheme };
}

export function PortalHeader({
  isLight,
  onToggleTheme,
  active
}: {
  isLight: boolean;
  onToggleTheme: () => void;
  active?: "inicio" | "codigo" | "presentar";
}) {
  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-md ${
        isLight ? "border-slate-200/70 bg-[#f8fbff]/80" : "border-white/10 bg-[#06121f]/80"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/logo-municipalidad-smt-transparent.png"
            alt="Municipalidad de San Miguel de Tucuman"
            width={40}
            height={40}
            priority
            className="h-10 w-10 object-contain"
          />
          <div className="min-w-0">
            <p className={`font-display text-base font-extrabold leading-none tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              UrbanIA
            </p>
            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Portal ciudadano
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/" label="Inicio" isLight={isLight} active={active === "inicio"} />
          <NavLink href="/codigo" label="Codigo" isLight={isLight} active={active === "codigo"} />
          <NavLink href="/presentar" label="Participacion" isLight={isLight} active={active === "presentar"} />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onToggleTheme}
            className={iconControlClass(isLight)}
            aria-label={isLight ? "Activar modo oscuro" : "Activar modo claro"}
            title={isLight ? "Modo oscuro" : "Modo claro"}
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <Link href="/ingresar" className={ghostButtonClass(isLight)}>
            <LogIn className="h-4 w-4" />
            Ingresar
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, isLight, active }: { href: string; label: string; isLight: boolean; active?: boolean }) {
  const base = "rounded-lg px-3 py-2 text-sm font-medium transition";
  if (active) {
    return (
      <Link href={href} className={`${base} ${isLight ? "bg-slate-100 text-slate-900" : "bg-white/[0.08] text-white"}`}>
        {label}
      </Link>
    );
  }
  return (
    <Link href={href} className={`${base} ${isLight ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}>
      {label}
    </Link>
  );
}

export function PortalFooter({ isLight }: { isLight: boolean }) {
  return (
    <footer className={`mt-20 border-t py-8 text-center text-xs ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"}`}>
      Municipalidad de San Miguel de Tucuman &middot; UrbanIA &middot; Portal ciudadano
    </footer>
  );
}

export function pageClass(isLight: boolean) {
  return isLight ? "min-h-screen bg-[#f8fbff] text-slate-900" : "min-h-screen bg-[#06121f] text-slate-100";
}

export function iconControlClass(isLight: boolean) {
  return `inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
  }`;
}

export function ghostButtonClass(isLight: boolean) {
  return `inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
      : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
  }`;
}

export function panelClass(isLight: boolean) {
  return `rounded-2xl border p-6 md:p-7 ${
    isLight ? "border-slate-200/80 bg-white shadow-card" : "border-white/10 bg-[#0d1b2a]"
  }`;
}

export function sectionTitleClass(isLight: boolean) {
  return `mt-4 font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.025em] md:text-3xl ${
    isLight ? "text-slate-900" : "text-white"
  }`;
}

export function bodyTextClass(isLight: boolean) {
  return `mt-3 text-sm leading-6 ${isLight ? "text-slate-600" : "text-slate-400"}`;
}

export function eyebrowClass(isLight: boolean) {
  return `inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
    isLight ? "text-slate-500" : "text-slate-400"
  }`;
}

export function primaryButtonClass() {
  // text-[#ffffff] y no text-white: la regla global `html.urban-light .text-white`
  // de globals.css pisaria el color y dejaria el texto azul marino sobre azul.
  return "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-civic-blue-deep px-6 text-sm font-semibold text-[#ffffff] shadow-[0_10px_30px_rgba(13,111,224,0.28)] transition hover:bg-[#0a5cbd]";
}

export function secondaryButtonClass(isLight: boolean) {
  return `inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-semibold transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:shadow-card"
      : "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
  }`;
}

export function cardClass(isLight: boolean) {
  return `rounded-2xl border p-4 text-left transition duration-200 ${
    isLight
      ? "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-card-hover"
      : "border-white/10 bg-white/[0.03] hover:border-sky-300/25 hover:bg-white/[0.05]"
  }`;
}

export function searchWrapClass(isLight: boolean) {
  return `flex h-11 items-center gap-2.5 rounded-xl border px-3.5 transition focus-within:ring-2 ${
    isLight
      ? "border-slate-200 bg-white focus-within:border-civic-blue focus-within:ring-civic-blue/15"
      : "border-white/10 bg-[#06121f] focus-within:border-sky-300/50 focus-within:ring-sky-300/10"
  }`;
}

export function searchInputClass(isLight: boolean) {
  return `min-w-0 flex-1 bg-transparent text-sm outline-none ${
    isLight ? "text-slate-900 placeholder:text-slate-400" : "text-slate-100 placeholder:text-slate-500"
  }`;
}

export function labelClass(isLight: boolean) {
  return `mb-2 block text-sm font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`;
}

export function chipClass(isLight: boolean) {
  return `rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
    isLight
      ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
  }`;
}

export function activeChipClass(isLight: boolean) {
  return `rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
    isLight ? "border-civic-blue-deep bg-civic-blue-deep text-[#ffffff]" : "border-sky-300/40 bg-sky-300/15 text-sky-100"
  }`;
}
