import {
  BarChart3,
  Bike,
  BookOpen,
  Building2,
  CircleDot,
  FileText,
  Landmark,
  Layers3,
  Map,
  MessageSquare,
  Network,
  Vote
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Mapa", icon: Map },
  { label: "Propuestas", icon: CircleDot },
  { label: "Normativa", icon: FileText },
  { label: "Casos de exito", icon: Landmark },
  { label: "Participacion", icon: Vote },
  { label: "Datos", icon: Layers3 }
];

export const sidebarSections = [
  {
    title: "Explorar",
    items: [
      { label: "Mapa interactivo", icon: Map },
      { label: "Indicadores", icon: BarChart3 },
      { label: "Proyectos", icon: Building2 },
      { label: "Infraestructura", icon: Network },
      { label: "Movilidad", icon: Bike }
    ]
  },
  {
    title: "Participacion",
    items: [
      { label: "Consulta ciudadana", icon: MessageSquare },
      { label: "Votaciones", icon: Vote },
      { label: "Asistente urbano", icon: BookOpen }
    ]
  }
];

export const metrics = [
  { label: "Propuestas activas", value: "128", delta: "+12%" },
  { label: "Ordenanzas vigentes", value: "53", delta: "+4" },
  { label: "Casos comparados", value: "27", delta: "+9" }
];

export const indicators = [
  { label: "Poblacion", value: "908.000", delta: "+1,2%" },
  { label: "Densidad", value: "5.650 hab/km2", delta: "+0,8%" },
  { label: "Areas verdes", value: "8,7 m2/hab", delta: "+3,1%" },
  { label: "Uso transporte publico", value: "38%", delta: "+2,4%" }
];

export const cityComparison = [
  { city: "Curitiba", value: 24.3 },
  { city: "Mendoza", value: 15.6 },
  { city: "Tucuman", value: 8.7 },
  { city: "Salta", value: 7.2 },
  { city: "S. S. de Jujuy", value: 6.1 }
];

export const successCases = [
  { city: "Curitiba", country: "Brasil", title: "Bus Rapid Transit", tag: "Movilidad" },
  { city: "Medellin", country: "Colombia", title: "Metrocable", tag: "Integracion social" },
  { city: "Mendoza", country: "Argentina", title: "Plan de arbolado", tag: "Ambiente" }
];

export const proposals = [
  { title: "Mejorar iluminacion en Barrio Sur", author: "Maria B.", votes: 24 },
  { title: "Plaza en Av. Belgrano y Peru", author: "Juan P.", votes: 18 },
  { title: "Mas bicisendas en el centro", author: "Lucia G.", votes: 35 },
  { title: "Parque lineal en Rio Sali", author: "Carlos M.", votes: 42 }
];

export const regulations = [
  { number: "Ordenanza 5987/20", title: "Codigo de Planeamiento Urbano" },
  { number: "Ordenanza 4003/15", title: "Codigo de Edificacion" },
  { number: "Ordenanza 6121/21", title: "Arbolado publico urbano" }
];
