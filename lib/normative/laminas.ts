/**
 * Laminas del CPU vigente: paginas del PDF original (TEXTO CPU 2014) con
 * tablas, croquis o planos que el import estructurado a texto plano no puede
 * representar. Las imagenes viven en public/normativa/cpu-2014 y las genera
 * scripts/generate-cpu-laminas.ts.
 *
 * El mapeo pagina -> articulo se hizo revisando el PDF pagina por pagina
 * (deteccion de trazos vectoriales e imagenes + verificacion visual).
 *
 * Este modulo NO lleva "server-only": el mapeo es un dato estatico y puede
 * necesitarse en componentes cliente (p. ej. el explorador del codigo).
 */

export type CpuLamina = {
  /** Pagina del PDF original. */
  page: number;
  /** Archivo dentro de public/normativa/cpu-2014. */
  file: string;
  /** Numero de articulo al que acompana, o null si es un plano general. */
  articleNumber: string | null;
  /** "tabla" | "croquis" se renderizan PNG; "plano" (escaneado) JPEG. */
  kind: "tabla" | "croquis" | "plano";
  caption: string;
};

export const CPU_LAMINAS: CpuLamina[] = [
  { page: 16, file: "p16.png", articleNumber: "20", kind: "tabla", caption: "Índice de planillas de usos del suelo y cuadro de espacios de carga y descarga (arts. 20 y 21)" },
  { page: 23, file: "p23.png", articleNumber: "26", kind: "croquis", caption: "Conexión de locales habitables Clase A al espacio urbano — situaciones I y II con sus cotas" },
  { page: 24, file: "p24.png", articleNumber: "26", kind: "croquis", caption: "Trazado del espacio centro de manzana — manzanas de 120 a 160 m" },
  { page: 25, file: "p25.png", articleNumber: "26", kind: "croquis", caption: "Trazado del espacio centro de manzana (continuación)" },
  { page: 26, file: "p26.png", articleNumber: "26", kind: "croquis", caption: "Trazado del espacio centro de manzana (continuación)" },
  { page: 27, file: "p27.png", articleNumber: "26", kind: "croquis", caption: "Trazado del espacio centro de manzana (continuación)" },
  { page: 28, file: "p28.png", articleNumber: "26", kind: "croquis", caption: "Trazado del espacio centro de manzana (continuación)" },
  { page: 32, file: "p32.png", articleNumber: "31", kind: "tabla", caption: "Tabla Nº 1 — coeficientes de ocupación por uso y fórmulas de cálculo (art. 31, Ascensores)" },
  { page: 33, file: "p33.png", articleNumber: "31", kind: "tabla", caption: "Tabla Nº 2 — personas en cabina y cantidad de ascensores (art. 31, Ascensores)" },
  { page: 35, file: "p35.png", articleNumber: "36", kind: "tabla", caption: "Índice de planillas de disposiciones particulares por distrito (art. 36)" },
  { page: 45, file: "p45.jpg", articleNumber: null, kind: "plano", caption: "Zonificación en distritos — plano general del municipio" },
  { page: 46, file: "p46.jpg", articleNumber: null, kind: "plano", caption: "Plano de zonificación — distritos áreas especiales" },
  { page: 47, file: "p47.jpg", articleNumber: null, kind: "plano", caption: "Plano de zonificación — sector 1/4 noroeste" },
  { page: 49, file: "p49.jpg", articleNumber: null, kind: "plano", caption: "Plano de zonificación — sector 2/4 noreste" },
  { page: 50, file: "p50.jpg", articleNumber: null, kind: "plano", caption: "Plano de zonificación — sector 3/4 sureste" },
  { page: 51, file: "p51.jpg", articleNumber: null, kind: "plano", caption: "Plano de zonificación — sector 4/4 suroeste" }
];

/** Laminas de un articulo puntual. */
export function laminasForArticle(articleNumber: string): CpuLamina[] {
  return CPU_LAMINAS.filter((lamina) => lamina.articleNumber === articleNumber);
}

/** Los planos generales (zonificacion), para anexar al final de un documento. */
export function planosGenerales(): CpuLamina[] {
  return CPU_LAMINAS.filter((lamina) => lamina.articleNumber === null);
}
