/**
 * Tipos y etiquetas del registro PUBLICO de audiencias. Separado de
 * public-data.ts (que es server-only por las consultas a la base) para que los
 * componentes del portal puedan importarlos sin arrastrar Prisma al cliente.
 */

/** Estado que ve el vecino. El detalle operativo (procesando, error) no se publica. */
export type PublicHearingStatus = "PROGRAMADA" | "REALIZADA" | "CANCELADA";

export const publicHearingStatusLabels: Record<PublicHearingStatus, string> = {
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada"
};

export type PublicHearingListItem = {
  id: string;
  title: string;
  occurredAt: string | null;
  location: string | null;
  topic: string | null;
  status: PublicHearingStatus;
  /** PDF del resumen ejecutivo, ya revisado y publicado por la Municipalidad. */
  summaryUrl: string | null;
  summaryPublishedAt: string | null;
};
