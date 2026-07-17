/**
 * Parsea la transcripcion de dos pasadas a segmentos estructurados.
 *
 * El texto viene en secciones "=== Minuto N ===" (una por tramo de audio) con
 * lineas "[mm:ss] ORADOR: texto". Los timestamps son relativos al tramo, asi
 * que el ms absoluto es offset del tramo + timestamp de la linea. Algunos
 * modelos envuelven en ** de markdown; se tolera.
 *
 * Sin "server-only" a proposito: es una funcion pura y se testea fuera de Next.
 */
export type ParsedSegment = {
  startMs: number;
  endMs: number;
  speakerLabel: string;
  content: string;
};

const SECTION_RE = /^===\s*Minuto\s+(\d+)\s*===\s*$/;
const LINE_RE = /^\**\[(\d{1,3}):(\d{2})\]\**\s*\**([^:*]{1,80}?)\**\s*:\s*(.*)$/;

export function parseTranscriptSegments(transcript: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let offsetMs = 0;

  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const section = line.match(SECTION_RE);
    if (section) {
      offsetMs = Number.parseInt(section[1], 10) * 60_000;
      continue;
    }

    const m = line.match(LINE_RE);
    if (m) {
      const [, mm, ss, speaker, text] = m;
      segments.push({
        startMs: offsetMs + Number.parseInt(mm, 10) * 60_000 + Number.parseInt(ss, 10) * 1000,
        endMs: 0,
        speakerLabel: speaker.trim(),
        content: text.trim()
      });
      continue;
    }

    // Linea de continuacion: pertenece a la ultima intervencion.
    const last = segments[segments.length - 1];
    if (last) {
      last.content += `\n${line}`;
    }
  }

  // endMs = arranque del siguiente segmento. El ultimo no tiene siguiente y queda
  // igual a su startMs: mejor un cero de duracion honesto que una duracion inventada.
  for (let i = 0; i < segments.length; i++) {
    segments[i].endMs = i + 1 < segments.length ? segments[i + 1].startMs : segments[i].startMs;
  }

  return segments;
}
