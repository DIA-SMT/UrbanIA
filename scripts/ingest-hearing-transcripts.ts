/**
 * Backfill: indexa al conocimiento de Migue la transcripción de las audiencias
 * ya cargadas (las nuevas se indexan solas al procesarse). Cubre todas las
 * fuentes (TXT, PDF, YouTube, audio), porque todas terminan como segmentos.
 *
 * Uso:
 *   npm run hearings:ingest-transcripts            → las que faltan indexar
 *   npm run hearings:ingest-transcripts -- --all   → reprocesa todas
 */

import { prisma } from "@/lib/db/prisma";
import { ingestHearingTranscript } from "@/lib/knowledge/ingest-hearing-report";

function log(message: string) {
  console.log(`[ingesta-transcripciones] ${message}`);
}

async function main() {
  const all = process.argv.includes("--all");

  const hearings = await prisma.meeting.findMany({
    where: { kind: "PUBLIC_HEARING", transcriptSegments: { some: {} } },
    select: { id: true, title: true, _count: { select: { transcriptSegments: true } } },
    orderBy: { createdAt: "asc" }
  });

  if (!hearings.length) {
    log("No hay audiencias con transcripción.");
    return;
  }

  const indexed = new Set(
    (
      await prisma.knowledgeSource.findMany({
        where: { kind: "MEETING", externalId: { startsWith: "hearing-transcript:" } },
        select: { externalId: true }
      })
    ).map((source) => source.externalId!.replace("hearing-transcript:", ""))
  );

  let done = 0;
  let skipped = 0;

  for (const hearing of hearings) {
    if (!all && indexed.has(hearing.id)) {
      skipped += 1;
      continue;
    }
    try {
      log(`Indexando "${hearing.title.slice(0, 50)}" (${hearing._count.transcriptSegments} segmentos)...`);
      const result = await ingestHearingTranscript(hearing.id);
      if (result) {
        log(`  → ${result.chunks} fragmentos.`);
        done += 1;
      } else {
        log("  → salteada (sin texto suficiente).");
        skipped += 1;
      }
    } catch (error) {
      log(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log(`Listo. ${done} indexada(s), ${skipped} salteada(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
