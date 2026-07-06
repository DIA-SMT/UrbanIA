import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileArchive,
  FileText,
  GitBranch,
  Landmark,
  Map,
  MessageSquareText,
  Settings2,
  Users
} from "lucide-react";

export const navItems = [
  { label: "Resumen", href: "/", icon: BarChart3 },
  { label: "Mapa territorial", href: "/mapa", icon: Map },
  { label: "Propuestas", href: "/propuestas", icon: ClipboardList },
  { label: "Proyectos", href: "/proyectos", icon: Building2 },
  { label: "Audiencias", href: "/audiencias", icon: CalendarDays },
  { label: "Asistente IA", href: "/asistente", icon: BookOpen }
];

export const sidebarSections = [
  {
    title: "Planificacion",
    items: [
      { label: "Mapa territorial", href: "/mapa", icon: Map },
      { label: "Propuestas", href: "/propuestas", icon: ClipboardList },
      { label: "Proyectos", href: "/proyectos", icon: Building2 }
    ]
  },
  {
    title: "Participacion",
    items: [
      { label: "Audiencias", href: "/audiencias", icon: CalendarDays },
      { label: "Aportes ciudadanos", href: "/participacion", icon: Users },
      { label: "Gabinete", href: "/gabinete", icon: Landmark }
    ]
  },
  {
    title: "Inteligencia",
    items: [
      { label: "Escenarios", href: "/escenarios", icon: GitBranch },
      { label: "Asistente IA", href: "/asistente", icon: MessageSquareText },
      { label: "Normativa", href: "/normativa", icon: FileText }
    ]
  },
  {
    title: "Gestion",
    items: [
      { label: "Documentos y datos", href: "/datos", icon: FileArchive },
      { label: "Indicadores", href: "/indicadores", icon: BarChart3 },
      { label: "Configuracion", href: "/infraestructura", icon: Settings2 }
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

export const modulePages = {
  mapa: {
    eyebrow: "Territorio inteligente",
    title: "Mapa interactivo urbano",
    description: "Explora capas territoriales, propuestas geolocalizadas y activos urbanos en una vista preparada para crecer hacia GIS real.",
    primaryAction: "Nueva capa",
    stats: [
      { label: "Capas listas", value: "5" },
      { label: "Puntos urbanos", value: "42" },
      { label: "Zonas priorizadas", value: "8" }
    ],
    cards: [
      { title: "Barrios y zonas", body: "Base territorial para organizar propuestas, indicadores y normativa por area.", tag: "GIS" },
      { title: "Espacios verdes", body: "Capa preparada para plazas, parques, arbolado y cobertura ambiental.", tag: "Ambiente" },
      { title: "Movilidad", body: "Corredores, ciclovias, transporte y calles con potencial de intervencion.", tag: "Transporte" }
    ]
  },
  normativa: {
    eyebrow: "Codigo de Planeamiento",
    title: "Codigo urbano por tematicas",
    description: "Consulta del Codigo de Planeamiento Urbano organizada por usos, alturas, retiros, movilidad, ambiente, patrimonio y riesgos.",
    primaryAction: "Cargar articulo",
    stats: [
      { label: "Tematicas", value: "7" },
      { label: "Articulos", value: "53" },
      { label: "Vinculos IA", value: "12" }
    ],
    cards: [
      { title: "Uso del suelo", body: "Distritos, compatibilidades, restricciones y criterios para evaluar propuestas oficiales.", tag: "CPU" },
      { title: "Alturas y retiros", body: "Parametros urbanisticos para analizar impacto edilicio, morfologia urbana y conflictividad.", tag: "Norma" },
      { title: "Movilidad y ambiente", body: "Criterios sobre espacio publico, accesibilidad, arbolado, drenaje y riesgos urbanos.", tag: "Temas" }
    ]
  },
  audiencias: {
    eyebrow: "Deliberacion publica",
    title: "Audiencias publicas",
    description: "Registro de audiencias vinculadas a propuestas urbanas, con fecha, expediente, acta, participantes, documentos y conclusiones.",
    primaryAction: "Registrar audiencia",
    stats: [
      { label: "Programadas", value: "3" },
      { label: "Con acta", value: "8" },
      { label: "Pendientes", value: "5" }
    ],
    cards: [
      { title: "Agenda institucional", body: "Fechas, ubicaciones, expedientes asociados y estado de convocatoria.", tag: "Agenda" },
      { title: "Actas y documentos", body: "Trazabilidad documental de exposiciones, anexos, dictamenes y conclusiones.", tag: "Actas" },
      { title: "Sintesis IA", body: "Resumen automatico de acuerdos, objeciones, temas frecuentes y riesgos normativos.", tag: "IA" }
    ]
  },
  casos: {
    eyebrow: "Aprendizaje comparado",
    title: "Casos de exito",
    description: "Biblioteca de soluciones urbanas para comparar Tucuman con experiencias aplicadas en otras ciudades.",
    primaryAction: "Agregar caso",
    stats: [
      { label: "Casos base", value: "27" },
      { label: "Ciudades", value: "9" },
      { label: "Tematicas", value: "6" }
    ],
    cards: [
      { title: "Movilidad activa", body: "Ciclovias, calles completas, sistemas de bicicletas y pacificacion vial.", tag: "Movilidad" },
      { title: "Espacio publico", body: "Peatonalizaciones, parques lineales, plazas y recuperacion de areas degradadas.", tag: "Urbano" },
      { title: "Gestion ambiental", body: "Arbolado, drenaje urbano, areas verdes y mitigacion de calor.", tag: "Ambiente" }
    ]
  },
  ciudades: {
    eyebrow: "Benchmark urbano",
    title: "Ciudades comparables",
    description: "Comparador curado para analizar indicadores, problemas y soluciones de ciudades similares a Tucuman.",
    primaryAction: "Comparar ciudad",
    stats: [
      { label: "Ciudades", value: "8" },
      { label: "Indicadores", value: "14" },
      { label: "Similitud media", value: "72%" }
    ],
    cards: [
      { title: "Salta", body: "Ciudad del norte argentino con desafios de movilidad, centro historico y crecimiento urbano.", tag: "Argentina" },
      { title: "Mendoza", body: "Referencia en arbolado, espacio publico y planificacion metropolitana.", tag: "Argentina" },
      { title: "Curitiba", body: "Caso internacional de transporte, corredores urbanos y gestion ambiental.", tag: "Brasil" }
    ]
  },
  propuestas: {
    eyebrow: "Gestion de iniciativas",
    title: "Propuestas urbanas",
    description: "Registro de ideas ciudadanas, tecnicas y de gabinete para convertirlas en escenarios analizables.",
    primaryAction: "Nueva propuesta",
    stats: [
      { label: "Activas", value: "128" },
      { label: "En evaluacion", value: "18" },
      { label: "Priorizadas", value: "6" }
    ],
    cards: [
      { title: "Ciclovia Av. Aconquija", body: "Escenario conceptual para evaluar movilidad, seguridad y ambiente.", tag: "Evaluacion" },
      { title: "Plaza Barrio Sur", body: "Idea urbana preparada para cruzarse con cobertura verde y densidad.", tag: "Ciudadania" },
      { title: "Iluminacion barrial", body: "Propuesta de mejora urbana con impacto en seguridad y espacio publico.", tag: "Prioridad" }
    ]
  },
  participacion: {
    eyebrow: "Integracion Cidituc",
    title: "Aportes ciudadanos",
    description: "Visualizacion de aportes recibidos desde Cidituc para alimentar propuestas, audiencias y analisis urbano sin duplicar la carga ciudadana.",
    primaryAction: "Importar aportes",
    stats: [
      { label: "Aportes", value: "1.240" },
      { label: "Barrios", value: "18" },
      { label: "Temas", value: "12" }
    ],
    cards: [
      { title: "Resumen territorial", body: "Aportes agrupados por barrio, propuesta vinculada y tipo de problematica urbana.", tag: "Cidituc" },
      { title: "Temas frecuentes", body: "Lectura de reclamos, apoyos, objeciones y prioridades detectadas en la participacion.", tag: "Sintesis" },
      { title: "Vinculo institucional", body: "Relaciona aportes ciudadanos con audiencias, expedientes y propuestas oficiales.", tag: "Trazabilidad" }
    ]
  },
  datos: {
    eyebrow: "Infraestructura de datos",
    title: "Fuentes de datos",
    description: "Catalogo de fuentes urbanas, indicadores y datasets que alimentaran el gemelo digital.",
    primaryAction: "Agregar fuente",
    stats: [
      { label: "Fuentes", value: "4" },
      { label: "Datasets", value: "16" },
      { label: "Confiabilidad", value: "Alta" }
    ],
    cards: [
      { title: "Municipalidad", body: "Datos internos de planificacion, obras, normativa y equipamiento.", tag: "Oficial" },
      { title: "INDEC", body: "Base demografica para poblacion, densidad y estructura territorial.", tag: "Estadistica" },
      { title: "Datos abiertos", body: "Fuentes externas para enriquecer mapas e indicadores.", tag: "Open data" }
    ]
  },
  asistente: {
    eyebrow: "Analisis IA",
    title: "Vinculos normativos inteligentes",
    description: "Interfaz para vincular propuestas, articulos del Codigo de Planeamiento, audiencias, aportes ciudadanos y problematicas urbanas comunes.",
    primaryAction: "Nueva consulta",
    stats: [
      { label: "Consultas", value: "0" },
      { label: "Fuentes listas", value: "3" },
      { label: "Modo", value: "RAG" }
    ],
    cards: [
      { title: "Buscar normativa", body: "Preguntas en lenguaje natural sobre ordenanzas y codigos urbanos.", tag: "Normas" },
      { title: "Generar informe", body: "Borradores de impacto para propuestas urbanas y reuniones de gabinete.", tag: "Informe" },
      { title: "Comparar casos", body: "Recomendaciones basadas en ciudades similares y casos documentados.", tag: "Benchmark" }
    ]
  },
  indicadores: {
    eyebrow: "Lectura urbana",
    title: "Indicadores urbanos",
    description: "Panel para evolucionar hacia series historicas, tableros por area y medicion de impactos.",
    primaryAction: "Nuevo indicador",
    stats: [
      { label: "Indicadores", value: "14" },
      { label: "Historicos", value: "0" },
      { label: "Areas", value: "5" }
    ],
    cards: [
      { title: "Poblacion y densidad", body: "Base para priorizar servicios, obras y equipamiento.", tag: "Demografia" },
      { title: "Espacios verdes", body: "Cobertura, metros cuadrados por habitante y deficit por zona.", tag: "Ambiente" },
      { title: "Movilidad", body: "Uso de transporte, corredores y accesibilidad territorial.", tag: "Transporte" }
    ]
  },
  proyectos: {
    eyebrow: "Cartera urbana",
    title: "Proyectos urbanos",
    description: "Seguimiento de obras, planes y proyectos estrategicos vinculados al mapa y a propuestas.",
    primaryAction: "Nuevo proyecto",
    stats: [
      { label: "En curso", value: "11" },
      { label: "Planificados", value: "24" },
      { label: "Finalizados", value: "7" }
    ],
    cards: [
      { title: "Obras publicas", body: "Control de estado, ubicacion, plazos y responsables.", tag: "Gestion" },
      { title: "Planificacion", body: "Proyectos estrategicos vinculados a zonas y normativas.", tag: "Plan" },
      { title: "Seguimiento", body: "Historial de avances para gabinete y comunicacion publica.", tag: "Estado" }
    ]
  },
  infraestructura: {
    eyebrow: "Sistemas urbanos",
    title: "Infraestructura",
    description: "Vista preparada para equipamiento, redes, activos publicos y mantenimiento urbano.",
    primaryAction: "Registrar activo",
    stats: [
      { label: "Activos", value: "240" },
      { label: "Categorias", value: "9" },
      { label: "Alertas", value: "3" }
    ],
    cards: [
      { title: "Equipamiento publico", body: "Escuelas, centros de salud, dependencias y espacios comunitarios.", tag: "Activos" },
      { title: "Red vial", body: "Calles, corredores y nodos prioritarios para intervenciones.", tag: "Movilidad" },
      { title: "Mantenimiento", body: "Base futura para reportes, ordenes de trabajo y seguimiento.", tag: "Operativo" }
    ]
  },
  movilidad: {
    eyebrow: "Movimiento urbano",
    title: "Movilidad",
    description: "Modulo para analizar transporte, ciclovias, accesibilidad y propuestas de circulacion.",
    primaryAction: "Nuevo escenario",
    stats: [
      { label: "Corredores", value: "12" },
      { label: "Ciclovias", value: "6" },
      { label: "Nodos criticos", value: "18" }
    ],
    cards: [
      { title: "Transporte publico", body: "Lineas, paradas, cobertura y conexiones metropolitanas.", tag: "Bus" },
      { title: "Movilidad activa", body: "Ciclovias, caminabilidad y seguridad vial.", tag: "Bici" },
      { title: "Transito", body: "Intervenciones de ordenamiento, estacionamiento y flujo vehicular.", tag: "Vial" }
    ]
  }
};

export type ModulePageKey = keyof typeof modulePages;
