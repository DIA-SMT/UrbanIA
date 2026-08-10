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
  /** Hay acta publicada (resumen o conclusiones) para leer en el detalle. */
  hasRecord: boolean;
};

export type PublicHearingDetail = {
  id: string;
  title: string;
  occurredAt: string | null;
  location: string | null;
  topic: string | null;
  status: PublicHearingStatus;
  summary: string | null;
  topics: string[];
  conclusions: string | null;
  agreements: string | null;
  nextSteps: string | null;
};
