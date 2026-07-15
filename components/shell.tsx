"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, FolderKanban, Home, LogIn, LogOut, Map, Menu, MessagesSquare, MoreHorizontal, Moon, Sun, Users, X } from "lucide-react";
import { MigueFloatingChat } from "@/components/assistant/migue-floating-chat";
import { Brand } from "@/components/brand";
import { sidebarSections } from "@/lib/data";

type ThemeMode = "dark" | "light";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
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
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="icon-button" aria-label="Volver" title="Volver"><ArrowLeft className="h-4 w-4" /></button>
                <Link href="/" className="icon-button" aria-label="Ir al inicio" title="Inicio"><Home className="h-4 w-4" /></Link>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={toggleTheme} className="icon-button" aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
                <UserMenu />
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

type SessionUser = { name: string; role: string };

const roleLabels: Record<string, string> = {
  ADMIN: "Administración",
  OFFICIAL: "Funcionario/a",
  TECHNICIAN: "Equipo técnico",
  CITIZEN: "Ciudadano/a"
};

function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => {
        if (mounted) setUser(payload.user ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  if (!loaded) {
    return null;
  }

  if (!user) {
    return (
      <Link href="/ingresar" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 md:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
        <LogIn className="h-4 w-4" />
        Ingresar
      </Link>
    );
  }

  return (
    <div ref={menuRef} className="relative hidden md:block">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold dark:border-white/10 dark:bg-white/[0.04]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1f89f6] text-xs text-white">{user.name.charAt(0).toUpperCase()}</span>
        <span className="max-w-32 truncate">{user.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d1b2a]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">{user.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{roleLabels[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-white/[0.05]"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarGroup({ section, pathname, open, collapsed = false, onToggle }: { section: SidebarSection; pathname: string; open: boolean; collapsed?: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  // Sección con href = link directo, sin desplegable.
  if (section.href) {
    const active = isActive(pathname, section.href);
    return <Link href={section.href} title={collapsed ? section.title : undefined} className={`nav-link group relative ${active ? "nav-link-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="flex-1 truncate text-left">{section.title}</span>}{active && <motion.span layoutId="active-nav" className="absolute left-0 h-5 w-0.5 rounded-r bg-[#1f89f6]" />}</Link>;
  }
  const active = section.items.some((item) => isActive(pathname, item.href));
  return <div><button onClick={onToggle} title={collapsed ? section.title : undefined} className={`nav-link group w-full ${active ? "text-sky-700 dark:text-sky-200" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <><span className="flex-1 text-left">{section.title}</span><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} /></>}</button><AnimatePresence initial={false}>{open && !collapsed ? <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden"><div className="ml-4 space-y-1 border-l border-slate-200 py-1 pl-2 dark:border-white/10">{section.items.map((item) => <SidebarLink key={item.label} {...item} active={isActive(pathname, item.href)} />)}</div></motion.div> : null}</AnimatePresence></div>;
}

function MobileBottomNavigation({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const items = [
    { label: "Mapa", href: "/admin", icon: Map },
    { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
    { label: "Participacion", href: "/audiencias", icon: Users },
    { label: "Consulta CPU", href: "/consulta-cpu", icon: MessagesSquare }
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
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroup(pathname: string) {
  const section = sidebarSections.find(
    (candidate) => (candidate.href && isActive(pathname, candidate.href)) || candidate.items.some((item) => isActive(pathname, item.href))
  );
  if (!section) return "Mapa";
  // Las secciones de link directo no tienen desplegable que abrir.
  return section.href ? "" : section.title;
}
