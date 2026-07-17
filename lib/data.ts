import {
  CalendarDays,
  Map,
  MessagesSquare,
  Scale,
  Users
} from "lucide-react";

type SidebarIcon = React.ComponentType<{ className?: string }>;
type SidebarItem = { label: string; href: string; icon: SidebarIcon };
type SidebarSection = {
  title: string;
  icon: SidebarIcon;
  /** Si está presente, la sección es un link directo sin desplegable. */
  href?: string;
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
  }
];
