import {
  CalendarDays,
  Fingerprint,
  Inbox,
  KeyRound,
  LifeBuoy,
  Lock,
  Map,
  MessagesSquare,
  Scale,
  ScrollText,
  Settings,
  Speech,
  ShieldCheck,
  UserCog,
  Users
} from "lucide-react";

type SidebarIcon = React.ComponentType<{ className?: string }>;
type SidebarItem = { label: string; href: string; icon: SidebarIcon };
type SidebarSection = {
  title: string;
  icon: SidebarIcon;
  /** Si está presente, la sección es un link directo sin desplegable. */
  href?: string;
  /** Solo se muestra a administradores (el server igual re-valida el permiso). */
  adminOnly?: boolean;
  /** Solo se muestra a usuarios internos logueados (no ciudadanos ni anónimos). */
  internalOnly?: boolean;
  items: SidebarItem[];
};

export const sidebarSections: SidebarSection[] = [
  {
    title: "Fábrica de Normas",
    icon: Scale,
    href: "/normas",
    items: []
  },
  {
    title: "Consulta al CPU",
    icon: MessagesSquare,
    href: "/consulta-cpu",
    items: []
  },
  {
    title: "Mapa territorial",
    icon: Map,
    href: "/admin",
    items: []
  },
  {
    title: "Audiencias",
    icon: CalendarDays,
    href: "/audiencias",
    items: []
  },
  {
    title: "Aportes ciudadanos",
    icon: Users,
    href: "/participacion",
    items: []
  },
  {
    title: "Foro de debates",
    icon: Speech,
    href: "/foro",
    internalOnly: true,
    items: []
  },
  {
    title: "Configuración",
    icon: Settings,
    adminOnly: true,
    items: [
      { label: "Usuarios", href: "/admin/configuracion/usuarios", icon: UserCog },
      { label: "Roles", href: "/admin/configuracion/roles", icon: ShieldCheck },
      { label: "Permisos", href: "/admin/configuracion/permisos", icon: KeyRound },
      { label: "Solicitudes de acceso", href: "/admin/configuracion/solicitudes", icon: Inbox },
      { label: "Integración SIDITUC", href: "/admin/configuracion/sidituc", icon: Fingerprint },
      { label: "Seguridad", href: "/admin/configuracion/seguridad", icon: Lock },
      { label: "Auditoría", href: "/admin/configuracion/auditoria", icon: ScrollText }
    ]
  },
  {
    title: "Ayuda",
    icon: LifeBuoy,
    href: "/ayuda",
    items: []
  }
];
