"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, FileText, FolderKanban, Map, Menu, MoreHorizontal, Moon, Plus, Search, Sun, Users, X } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import { Brand } from "@/components/brand";
import { sidebarSections } from "@/lib/data";

type ThemeMode = "dark" | "light";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(() => findActiveGroup(pathname));

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("urbania-theme") === "dark" ? "dark" : "light";
    const savedCollapsed = window.localStorage.getItem("urbania-sidebar") === "collapsed";
    setTheme(savedTheme);
    setCollapsed(savedCollapsed);
    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(findActiveGroup(pathname));
  }, [pathname]);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("urbania-theme", nextTheme);
    applyTheme(nextTheme);
  }

  function toggleSidebar() {
    setCollapsed((current) => {
      window.localStorage.setItem("urbania-sidebar", current ? "expanded" : "collapsed");
      return !current;
    });
  }

  return (
    <main className="min-h-screen bg-urban-canvas text-slate-900 transition-colors duration-300 dark:bg-[#07111d] dark:text-slate-100">
      <div className="flex min-h-screen">
        <motion.aside
          animate={{ width: collapsed ? 84 : 244 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200/80 bg-white/95 p-3 shadow-[8px_0_32px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:flex lg:flex-col dark:border-white/10 dark:bg-[#091725]/95"
        >
          <div className={`relative flex h-16 items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
            <div className={collapsed ? "[&>div>div:last-child]:hidden" : ""}><Brand /></div>
            {!collapsed && <button onClick={toggleSidebar} className="icon-button" aria-label="Colapsar navegacion"><ChevronLeft className="h-4 w-4" /></button>}
            {collapsed && (
              <button
                onClick={toggleSidebar}
                className="absolute -right-6 top-1/2 z-50 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-[#102235] dark:text-slate-200"
                aria-label="Expandir navegacion"
                title="Expandir navegacion"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            )}
          </div>
          <nav className="urban-scrollbar mt-3 flex-1 space-y-1 overflow-y-auto pb-4" aria-label="Navegacion principal">
            {sidebarSections.map((section) => <SidebarGroup key={section.title} section={section} pathname={pathname} open={openGroup === section.title} collapsed={collapsed} onToggle={() => { if (collapsed) toggleSidebar(); setOpenGroup((current) => current === section.title && !collapsed ? "" : section.title); }} />)}
          </nav>
          <button onClick={toggleSidebar} className={`nav-link mt-auto ${collapsed ? "justify-center" : ""}`} title={collapsed ? "Expandir navegacion" : undefined}>
            <Menu className="h-4 w-4 shrink-0" />{!collapsed && <span>Contraer menú</span>}
          </button>
        </motion.aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" aria-label="Cerrar navegacion" />
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="fixed inset-y-0 left-0 z-50 w-[278px] overflow-y-auto bg-white p-4 shadow-2xl dark:bg-[#091725] lg:hidden">
                <div className="flex items-center justify-between"><Brand /><button onClick={() => setMobileOpen(false)} className="icon-button"><X className="h-5 w-5" /></button></div>
                <nav className="mt-7 space-y-1">{sidebarSections.map((section) => <SidebarGroup key={section.title} section={section} pathname={pathname} open={openGroup === section.title} onToggle={() => setOpenGroup((current) => current === section.title ? "" : section.title)} />)}</nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className={`min-w-0 flex-1 transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[244px]"}`}>
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#07111d]/85 md:px-6">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="icon-button lg:hidden" aria-label="Abrir navegacion"><Menu className="h-5 w-5" /></button>
              <div className="lg:hidden"><Brand /></div>
              <button className="hidden min-w-0 max-w-md flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-sky-300 hover:bg-white md:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
                <Search className="h-4 w-4" /><span className="truncate">Buscar proyectos, normativa, audiencias...</span><kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/5">⌘ K</kbd>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <Link href="/propuestas" className="primary-button hidden sm:inline-flex"><Plus className="h-4 w-4" />Nueva propuesta</Link>
                <button onClick={toggleTheme} className="icon-button" aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
                <button className="icon-button relative" aria-label="Actividad"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#07111d]" /></button>
                <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold md:flex dark:border-white/10 dark:bg-white/[0.04]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1f89f6] text-xs text-white">A</span><span>Agustín</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
              </div>
            </div>
          </header>
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="mx-auto max-w-[1600px] p-4 pb-24 md:p-6 md:pb-24 lg:pb-6 xl:p-8">{children}</motion.div>
        </div>
      </div>
      <MobileBottomNavigation pathname={pathname} onMore={() => setMobileOpen(true)} />
      <MigueFloatingChat appearance={theme} />
    </main>
  );
}

type SidebarSection = (typeof sidebarSections)[number];

function SidebarGroup({ section, pathname, open, collapsed = false, onToggle }: { section: SidebarSection; pathname: string; open: boolean; collapsed?: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  const active = section.items.some((item) => isActive(pathname, item.href));
  return <div><button onClick={onToggle} title={collapsed ? section.title : undefined} className={`nav-link group w-full ${active ? "text-sky-700 dark:text-sky-200" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <><span className="flex-1 text-left">{section.title}</span><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} /></>}</button><AnimatePresence initial={false}>{open && !collapsed ? <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden"><div className="ml-4 space-y-1 border-l border-slate-200 py-1 pl-2 dark:border-white/10">{section.items.map((item) => <SidebarLink key={item.label} {...item} active={isActive(pathname, item.href)} />)}</div></motion.div> : null}</AnimatePresence></div>;
}

function MobileBottomNavigation({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const items = [
    { label: "Mapa", href: "/admin", icon: Map },
    { label: "Expedientes", href: "/propuestas", icon: FolderKanban },
    { label: "Participacion", href: "/audiencias", icon: Users },
    { label: "Normativa", href: "/normativa", icon: FileText }
  ];
  return <nav aria-label="Navegacion movil" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#091725]/95 lg:hidden">{items.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link key={item.label} href={item.href} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold ${active ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200" : "text-slate-500"}`}><Icon className="h-4 w-4" /><span className="truncate">{item.label}</span></Link>; })}<button onClick={onMore} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold text-slate-500"><MoreHorizontal className="h-4 w-4" /><span>Mas</span></button></nav>;
}

function SidebarLink({ href, label, icon: Icon, active, collapsed = false }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; collapsed?: boolean }) {
  return <Link href={href} title={collapsed ? label : undefined} className={`nav-link group relative ${active ? "nav-link-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="truncate">{label}</span>}{active && <motion.span layoutId="active-nav" className="absolute left-0 h-5 w-0.5 rounded-r bg-[#1f89f6]" />}</Link>;
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("urban-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

function isActive(pathname: string, href: string) {
  if (href.startsWith("/escenarios/")) return pathname.startsWith("/escenarios/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroup(pathname: string) {
  return sidebarSections.find((section) => section.items.some((item) => isActive(pathname, item.href)))?.title ?? "Mapa";
}
