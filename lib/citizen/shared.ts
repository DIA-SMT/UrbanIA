import type { CitizenContributionKind } from "@prisma/client";

/**
 * Tipos del ranking de demanda ciudadana. Viven aparte de topics-demand.ts porque
 * ese archivo es server-only (toca Prisma) y el panel de la Fabrica es un client
 * component: importar el modulo entero desde el cliente romperia el build.
 */

/** Un aporte concreto, para que el redactor lea lo que escribio el vecino. */
export type ContributionSample = {
  id: string;
  kind: CitizenContributionKind;
  zone: string;
  /** Recortado en la capa de datos: el panel no necesita el texto entero. */
  text: string;
  axis: string;
  /** Por que Migue eligio ese eje, con el articulo. Es la referencia util. */
  axisReason: string | null;
  relatedTopic: string | null;
  axisConfirmed: boolean;
  createdAt: string;
};

export type TopicDemand = {
  /** Etiqueta del eje tal como se guarda en CitizenContribution.axis. */
  axisLabel: string;
  /** Id del tema en la taxonomia. Null = eje heredado que ya no existe. */
  topicId: string | null;
  summary: string | null;
  chapters: string[];
  outOfScope: boolean;
  /** Aportes clasificados directamente en este eje. */
  total: number;
  /** Cuantos de esos confirmo una persona (el resto los sugirio Migue). */
  confirmed: number;
  topZones: string[];
  lastContributionAt: string | null;
  /**
   * Aportes fuera del alcance del CPU que rozan este tema. No se suman a `total`:
   * son demanda relacionada, no demanda directa, y el redactor tiene que poder
   * distinguirlas para no sobreestimar el pedido.
   */
  relatedTotal: number;
  samples: ContributionSample[];
};

export type TopicsDemandPayload = {
  /** Temas del CPU redactables como norma, ordenados por demanda directa. */
  topics: TopicDemand[];
  /**
   * Lo que el CPU no regula. Se devuelve como bloque propio y con sus aportes a la
   * vista: el vecino escribio igual, y que el Codigo no lo regule no es motivo para
   * esconderlo. No habilita redactar una norma.
   */
  outOfScope: TopicDemand | null;
  /** Ejes de taxonomias viejas que ya no existen (ej. "Ambiente"). */
  legacy: TopicDemand[];
  /** Aportes que nadie clasifico todavia: trabajo pendiente, no un tema. */
  unclassifiedCount: number;
  totalContributions: number;
  isLive: boolean;
};

export const EMPTY_TOPICS_DEMAND: TopicsDemandPayload = {
  topics: [],
  outOfScope: null,
  legacy: [],
  unclassifiedCount: 0,
  totalContributions: 0,
  isLive: false
};
