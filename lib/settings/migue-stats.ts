import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Lecturas del panel "qué pregunta la gente" (/admin/configuracion/migue).
 *
 * Todo sale de AiQuery, que junta las dos vías de consulta a Migue (el chat
 * flotante y la Consulta CPU, distinguidas por `module`), más MigueFeedback para
 * los pulgares. La escritura vive en lib/ai/query-log.ts.
 *
 * Varias consultas van en SQL crudo y no con el API de Prisma: agrupar por día
 * exige truncar la fecha, y el ranking de fuentes exige abrir el JSON de
 * `sources` — dos cosas que Prisma no expresa. Ninguna recibe entrada del
 * usuario: la ventana de días es un número validado por quien llama.
 */

export type MigueStatsWindow = 7 | 30 | 90;

export type DailyVolume = { day: string; total: number; unanswered: number };
export type ModuleVolume = { module: string; total: number; unanswered: number };
export type TopSource = { reference: string; title: string | null; citations: number };
export type UnansweredQuery = { id: string; question: string; module: string | null; createdAt: Date };
export type FeedbackReason = { reason: string; count: number };

export type MigueStats = {
  window: MigueStatsWindow;
  /**
   * Consultas reales: NO incluye las descartadas.
   *
   * Todas las métricas de demanda usan este universo. Una consulta "bot" no es
   * demanda insatisfecha, y contarla movía la tasa de huecos lo suficiente para
   * volverla inservible: con 12 consultas cargadas, una sola daba 42%.
   */
  total: number;
  /** Mensajes que no eran una consulta. Se muestran aparte, no se esconden. */
  discarded: number;
  unanswered: number;
  /** Porcentaje redondeado sobre las consultas reales. 0 si no hubo ninguna. */
  unansweredRate: number;
  normative: number;
  daily: DailyVolume[];
  byModule: ModuleVolume[];
  topSources: TopSource[];
  recentUnanswered: UnansweredQuery[];
  feedback: { up: number; down: number; reasons: FeedbackReason[] };
};

/** Arranque de la ventana: hoy menos los días pedidos, a medianoche. */
function windowStart(days: MigueStatsWindow): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export async function getMigueStats(days: MigueStatsWindow = 30): Promise<MigueStats> {
  const since = windowStart(days);

  // Universo de todas las lecturas de demanda: consultas reales, sin las
  // descartadas. Se declara una vez y se reusa para que ninguna metrica quede
  // contando un universo distinto al de las demas.
  const reales = { createdAt: { gte: since }, discarded: false };

  // Todo en una sola tanda: la pantalla no puede dibujar nada hasta tener el
  // conjunto completo, asi que encadenarlas solo sumaria latencia.
  const [total, discarded, unanswered, normative, daily, byModule, topSources, recentUnanswered, feedbackRows, reasons] =
    await Promise.all([
      prisma.aiQuery.count({ where: reales }),
      prisma.aiQuery.count({ where: { createdAt: { gte: since }, discarded: true } }),
      prisma.aiQuery.count({ where: { ...reales, answered: false } }),
      prisma.aiQuery.count({ where: { ...reales, normative: true } }),
      dailyVolume(since),
      moduleVolume(since),
      topCitedSources(since),
      prisma.aiQuery.findMany({
        where: { ...reales, answered: false },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, question: true, module: true, createdAt: true }
      }),
      prisma.migueFeedback.groupBy({
        by: ["rating"],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      }),
      feedbackReasons(since)
    ]);

  return {
    window: days,
    total,
    discarded,
    unanswered,
    unansweredRate: total === 0 ? 0 : Math.round((unanswered / total) * 100),
    normative,
    daily,
    byModule,
    topSources,
    recentUnanswered,
    feedback: {
      up: feedbackRows.find((row) => row.rating === "up")?._count._all ?? 0,
      down: feedbackRows.find((row) => row.rating === "down")?._count._all ?? 0,
      reasons
    }
  };
}

/**
 * Consultas por día. Devuelve solo los días con actividad: rellenar los vacíos es
 * cosa de la pantalla, que es la que sabe cómo quiere dibujarlos.
 */
async function dailyVolume(since: Date): Promise<DailyVolume[]> {
  // El corte del dia va en hora de Tucuman y NO en UTC: createdAt es timestamptz,
  // asi que un date_trunc directo agruparia en UTC y una consulta hecha despues de
  // las 21:00 locales caeria en el dia siguiente. El panel quedaria corrido.
  //
  // La fecha sale ya formateada como texto en vez de volver como Date: evita que
  // el valor haga otro viaje de zona horaria al convertirse en JavaScript.
  const rows = await prisma.$queryRaw<{ day: string; total: bigint; unanswered: bigint }[]>(Prisma.sql`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'America/Argentina/Tucuman'), 'YYYY-MM-DD') AS day,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE NOT "answered") AS unanswered
    FROM "AiQuery"
    WHERE "createdAt" >= ${since}
      AND NOT "discarded"
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return rows.map((row) => ({
    day: row.day,
    total: Number(row.total),
    unanswered: Number(row.unanswered)
  }));
}

/** Volumen por canal: el chat flotante y la Consulta CPU se comparan entre sí. */
async function moduleVolume(since: Date): Promise<ModuleVolume[]> {
  const [rows, unansweredRows] = await Promise.all([
    prisma.aiQuery.groupBy({
      by: ["module"],
      where: { createdAt: { gte: since }, discarded: false },
      _count: { _all: true },
      orderBy: { _count: { module: "desc" } }
    }),
    prisma.aiQuery.groupBy({
      by: ["module"],
      where: { createdAt: { gte: since }, discarded: false, answered: false },
      _count: { _all: true }
    })
  ]);

  return rows.map((row) => ({
    module: row.module ?? "sin identificar",
    total: row._count._all,
    unanswered: unansweredRows.find((entry) => entry.module === row.module)?._count._all ?? 0
  }));
}

/**
 * Qué partes del Código se consultan más, contando las citas de cada respuesta.
 *
 * Es la métrica más barata de "temas más tratados" y no necesita clasificar nada:
 * las citas ya están guardadas. Se agrupa por `reference` (el artículo o el
 * documento) porque el título puede venir escrito distinto entre canales.
 */
async function topCitedSources(since: Date): Promise<TopSource[]> {
  const rows = await prisma.$queryRaw<{ reference: string; title: string | null; citations: bigint }[]>(Prisma.sql`
    SELECT source->>'reference' AS reference,
           MAX(source->>'title') AS title,
           COUNT(*) AS citations
    FROM "AiQuery" AS q,
         -- El CASE va DENTRO del argumento a proposito: jsonb_array_elements
         -- aborta la consulta si no recibe un array, y filtrar por jsonb_typeof
         -- en el WHERE no alcanza porque el join lateral se evalua antes. Asi la
         -- funcion siempre recibe un array y una fila mal formada aporta cero
         -- elementos en vez de tumbar la pantalla entera.
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(q."sources"::jsonb) = 'array' THEN q."sources"::jsonb ELSE '[]'::jsonb END
         ) AS source
    WHERE q."createdAt" >= ${since}
      AND NOT q."discarded"
      AND source->>'reference' IS NOT NULL
      AND source->>'reference' <> ''
    GROUP BY 1
    ORDER BY citations DESC, reference ASC
    LIMIT 15
  `);

  return rows.map((row) => ({ reference: row.reference, title: row.title, citations: Number(row.citations) }));
}

/** Motivos elegidos en los pulgares abajo. Solo los votos negativos los traen. */
async function feedbackReasons(since: Date): Promise<FeedbackReason[]> {
  const rows = await prisma.migueFeedback.groupBy({
    by: ["reason"],
    where: { createdAt: { gte: since }, rating: "down", reason: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { reason: "desc" } },
    take: 8
  });

  return rows.map((row) => ({ reason: row.reason ?? "sin motivo", count: row._count._all }));
}
