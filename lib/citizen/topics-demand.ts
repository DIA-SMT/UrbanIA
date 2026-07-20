import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  CPU_TOPICS,
  OUT_OF_SCOPE_TOPIC,
  UNCLASSIFIED_AXIS,
  isOutOfScope,
  topicByLabel
} from "@/lib/citizen/contributions";
import type { ContributionSample, TopicDemand, TopicsDemandPayload } from "@/lib/citizen/shared";

/**
 * Que temas del CPU esta pidiendo la ciudadania, agregando CitizenContribution.axis.
 *
 * Tres decisiones que explican la forma del resultado:
 *
 * 1. "Sin clasificar" no es un tema, es trabajo pendiente. Sale del ranking pero se
 *    devuelve su conteo: esconderlo haria parecer que todo esta clasificado.
 * 2. "Fuera del alcance del CPU" tampoco es redactable, pero se devuelve como bloque
 *    propio y CON sus aportes: el vecino escribio igual y merece verse.
 * 3. Un axis que no resuelve contra la taxonomia es un eje heredado (la heuristica
 *    vieja etiquetaba "Ambiente"). No se descarta en silencio ni se lo trata como
 *    tema del CPU: va a `legacy`, visible y sin accion.
 */

/** Cuantos aportes se leen para mostrar de ejemplo. Los conteos NO salen de aca. */
const SAMPLE_POOL = 400;
const SAMPLES_PER_TOPIC = 4;
const SAMPLE_TEXT_LENGTH = 400;
const TOP_ZONES = 3;

function toSample(row: {
  id: string;
  kind: ContributionSample["kind"];
  zone: string;
  text: string;
  axis: string;
  axisReason: string | null;
  relatedTopic: string | null;
  axisConfirmed: boolean;
  createdAt: Date;
}): ContributionSample {
  return {
    id: row.id,
    kind: row.kind,
    zone: row.zone,
    text: row.text.length > SAMPLE_TEXT_LENGTH ? `${row.text.slice(0, SAMPLE_TEXT_LENGTH)}…` : row.text,
    axis: row.axis,
    axisReason: row.axisReason,
    relatedTopic: row.relatedTopic,
    axisConfirmed: row.axisConfirmed,
    createdAt: row.createdAt.toISOString()
  };
}

export async function getTopicsDemand(): Promise<TopicsDemandPayload> {
  const [byAxis, byAxisZone, byRelated, confirmedByAxis, samplePool, totalContributions] = await Promise.all([
    prisma.citizenContribution.groupBy({
      by: ["axis"],
      _count: { _all: true },
      _max: { createdAt: true }
    }),
    prisma.citizenContribution.groupBy({
      by: ["axis", "zone"],
      _count: { _all: true }
    }),
    prisma.citizenContribution.groupBy({
      by: ["relatedTopic"],
      where: { relatedTopic: { not: null } },
      _count: { _all: true }
    }),
    prisma.citizenContribution.groupBy({
      by: ["axis"],
      where: { axisConfirmed: true },
      _count: { _all: true }
    }),
    prisma.citizenContribution.findMany({
      orderBy: { createdAt: "desc" },
      take: SAMPLE_POOL,
      select: {
        id: true,
        kind: true,
        zone: true,
        text: true,
        axis: true,
        axisReason: true,
        relatedTopic: true,
        axisConfirmed: true,
        createdAt: true
      }
    }),
    prisma.citizenContribution.count()
  ]);

  const totalByAxis = new Map(byAxis.map((row) => [row.axis, row._count._all]));
  const lastByAxis = new Map(byAxis.map((row) => [row.axis, row._max.createdAt]));
  const confirmedMap = new Map(confirmedByAxis.map((row) => [row.axis, row._count._all]));
  const relatedMap = new Map(byRelated.map((row) => [row.relatedTopic ?? "", row._count._all]));

  // Zonas mas frecuentes por eje. Se ordena en memoria porque groupBy no admite
  // ordenar por _count sobre una clave compuesta y los volumenes son chicos.
  const zonesByAxis = new Map<string, { zone: string; count: number }[]>();
  for (const row of byAxisZone) {
    const bucket = zonesByAxis.get(row.axis) ?? [];
    bucket.push({ zone: row.zone, count: row._count._all });
    zonesByAxis.set(row.axis, bucket);
  }

  const samplesByAxis = new Map<string, ContributionSample[]>();
  for (const row of samplePool) {
    const bucket = samplesByAxis.get(row.axis) ?? [];
    if (bucket.length < SAMPLES_PER_TOPIC) bucket.push(toSample(row));
    samplesByAxis.set(row.axis, bucket);
  }

  const buildDemand = (axisLabel: string): TopicDemand => {
    const topic = topicByLabel(axisLabel);
    const lastAt = lastByAxis.get(axisLabel) ?? null;
    const zones = (zonesByAxis.get(axisLabel) ?? [])
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_ZONES)
      .map((entry) => entry.zone);

    return {
      axisLabel,
      topicId: topic?.id ?? null,
      summary: topic?.summary ?? null,
      chapters: topic?.chapters ?? [],
      outOfScope: isOutOfScope(axisLabel),
      total: totalByAxis.get(axisLabel) ?? 0,
      confirmed: confirmedMap.get(axisLabel) ?? 0,
      topZones: zones,
      lastContributionAt: lastAt ? lastAt.toISOString() : null,
      relatedTotal: relatedMap.get(axisLabel) ?? 0,
      samples: samplesByAxis.get(axisLabel) ?? []
    };
  };

  // Los 4 temas del CPU se devuelven siempre, incluso en cero: un tema sin pedidos
  // es informacion (nadie reclamo sobre eso), no una fila que haya que ocultar.
  const topics = CPU_TOPICS.map((topic) => buildDemand(topic.label)).sort(
    (a, b) => b.total - a.total || b.relatedTotal - a.relatedTotal || a.axisLabel.localeCompare(b.axisLabel)
  );

  const outOfScopeDemand = buildDemand(OUT_OF_SCOPE_TOPIC.label);

  // Todo lo que quedo afuera: ni tema del CPU, ni fuera-de-alcance, ni sin clasificar.
  const known = new Set([...CPU_TOPICS.map((topic) => topic.label), OUT_OF_SCOPE_TOPIC.label, UNCLASSIFIED_AXIS]);
  const legacy = byAxis
    .filter((row) => !known.has(row.axis) && row.axis.trim().length > 0)
    .map((row) => buildDemand(row.axis))
    .sort((a, b) => b.total - a.total);

  return {
    topics,
    outOfScope: outOfScopeDemand.total > 0 ? outOfScopeDemand : null,
    legacy,
    unclassifiedCount: totalByAxis.get(UNCLASSIFIED_AXIS) ?? 0,
    totalContributions,
    isLive: true
  };
}

/**
 * Aportes que respaldan un tema, para que el redactor de la norma los tenga a mano.
 * Incluye los que rozan el tema desde fuera del alcance (relatedTopic): no son un
 * pedido de norma sobre el tema, pero explican por que el tema aparece.
 */
export async function listContributionsForTopic(axisLabel: string, limit = 20): Promise<ContributionSample[]> {
  const rows = await prisma.citizenContribution.findMany({
    where: { OR: [{ axis: axisLabel }, { relatedTopic: axisLabel }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      zone: true,
      text: true,
      axis: true,
      axisReason: true,
      relatedTopic: true,
      axisConfirmed: true,
      createdAt: true
    }
  });

  return rows.map(toSample);
}
