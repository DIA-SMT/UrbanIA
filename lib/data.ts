import {
  CalendarDays,
  Inbox,
  KeyRound,
  LifeBuoy,
  Lightbulb,
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
  /**
   * Permiso concreto que exige la pantalla destino. Cuando está, manda sobre los
   * flags de arriba: es lo único que no se desincroniza del guard del server
   * ahora que la matriz de permisos se edita desde la interfaz.
   */
  permission?: string;
  /** Ancla del recorrido guiado: se emite como data-tour en el enlace. */
  tourId?: string;
  items: SidebarItem[];
};

export const sidebarSections: SidebarSection[] = [
  {
    title: "Fábrica de Normas",
    icon: Scale,
    href: "/normas",
    tourId: "nav-normas",
    items: []
  },
  {
    title: "Consulta al CPU",
    icon: MessagesSquare,
    href: "/consulta-cpu",
    tourId: "nav-cpu",
    items: []
  },
  {
    title: "Mapa territorial",
    icon: Map,
    href: "/admin",
    tourId: "nav-mapa",
    items: []
  },
  {
    title: "Audiencias",
    icon: CalendarDays,
    href: "/audiencias",
    tourId: "nav-audiencias",
    items: []
  },
  {
    title: "Aportes ciudadanos",
    icon: Users,
    href: "/participacion",
    // La bandeja muestra nombre, DNI y email de cada vecino: la gobierna
    // proposals.manage, no el acceso general al sistema interno.
    permission: "proposals.manage",
    tourId: "nav-participacion",
    items: []
  },
  {
    title: "Foro de debates",
    icon: Speech,
    href: "/foro",
    internalOnly: true,
    tourId: "nav-foro",
    items: []
  },
  {
    title: "Configuración",
    icon: Settings,
    adminOnly: true,
    tourId: "nav-config",
    items: [
      { label: "Usuarios", href: "/admin/configuracion/usuarios", icon: UserCog },
      { label: "Roles", href: "/admin/configuracion/roles", icon: ShieldCheck },
      { label: "Permisos", href: "/admin/configuracion/permisos", icon: KeyRound },
      { label: "Solicitudes de acceso", href: "/admin/configuracion/solicitudes", icon: Inbox },
      { label: "Seguridad", href: "/admin/configuracion/seguridad", icon: Lock },
      { label: "Recomendaciones", href: "/admin/configuracion/recomendaciones", icon: Lightbulb },
      { label: "Auditoría", href: "/admin/configuracion/auditoria", icon: ScrollText }
    ]
  },
  {
    title: "Ayuda",
    icon: LifeBuoy,
    href: "/admin/ayuda",
    internalOnly: true,
    items: []
  }
];
