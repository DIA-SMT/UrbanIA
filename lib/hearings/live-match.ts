// Sin "server-only": este modulo tambien lo importa el worker CLI de ingesta
// (scripts/ingest-youtube-hearings.ts), que corre con tsx fuera de Next.
import { z } from "zod";
import { Prisma, type HearingMatchStance } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import type { HearingMatchView } from "@/lib/hearings/shared";

/**
 * Macheo en vivo: dado el ultimo tramo transcripto de una audiencia publica,
 * detecta que mininormas del codigo nuevo (Fabrica de Normas) se estan
 * discutiendo, con que postura y con que fragmento.
 *
 * Corre muchas veces por audiencia: modelo liviano, prompt corto y maxTokens
 * acotado. Los macheos son sugerencias para el equipo; no deciden nada.
 *
 * Escala (documentado, no implementado): si la reforma crece a decenas altas
 * de normas, pre-filtrar candidatas por similitud antes de llamar a la IA con
 * lib/ai/embeddings (embedQuery(window) vs embedPassages de title+summary,
 * e5-small, tomar top ~15). Con el CPU actual (~52 articulos) el catalogo
 * completo entra comodo en contexto.
 */

export type LiveMatch = {
  normId: string;
  code: string;
  title: string;
  articleNumber: string | null;
  fragment: string;
  stance: HearingMatchStance;
  confidence: number;
};

const MAX_SUMMARY_CHARS = 220;
const MAX_ARTICLE_CHARS = 240;

const matchOutputSchema = z.object({
  matches: z
    .array(
      z.object({
        normId: z.string().trim().min(1),
        fragment: z.string().trim().min(1).max(500),
        stance: z.enum(["SUPPORT", "OPPOSE", "CHANGE_REQUEST", "MENTION"]),
        confidence: z.number().min(0).max(1)
      })
    )
    .max(8)
    .default([])
});

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export type NormCatalogEntry = {
  id: string;
  code: string;
  title: string;
  articleNumber: string | null;
  summary: string;
  articleText: string | null;
};

/** Catalogo de mininormas de una reforma, para machear varias ventanas. */
export async function loadNormCatalog(reformId: string): Promise<NormCatalogEntry[]> {
  return prisma.project.findMany({
    where: { reformId },
    select: { id: true, code: true, title: true, articleNumber: true, summary: true, articleText: true },
    take: 200
  });
}

export async function matchTranscriptWindow({
  reformId,
  window
}: {
  reformId: string;
  window: string;
}): Promise<LiveMatch[]> {
  // Sin IA configurada, el modo en vivo sigue transcribiendo sin macheo.
  if (!hasOpenRouterConfig()) return [];

  const norms = await loadNormCatalog(reformId);
  return detectMatchesAgainstNorms(norms, window);
}

/** Machea una ventana contra un catalogo ya cargado (lo usa el worker batch). */
export async function detectMatchesAgainstNorms(norms: NormCatalogEntry[], window: string): Promise<LiveMatch[]> {
  if (!hasOpenRouterConfig() || !norms.length) return [];

  const normById = new Map(norms.map((norm) => [norm.id, norm]));

  const catalog = norms
    .map((norm) =>
      [
        `- normId: ${norm.id} | ${norm.code}${norm.articleNumber ? ` | Art. ${norm.articleNumber}` : ""} | ${norm.title}`,
        `  Objeto: ${truncate(norm.summary, MAX_SUMMARY_CHARS)}`,
        ...(norm.articleText ? [`  Articulado: ${truncate(norm.articleText, MAX_ARTICLE_CHARS)}`] : [])
      ].join("\n")
    )
    .join("\n");

  const system = [
    "Sos Migue, asistente IA de UrbanIA, analizando EN VIVO una audiencia publica sobre el codigo de planeamiento nuevo.",
    "Recibis (a) un catalogo de mininormas candidatas del codigo nuevo y (b) el ultimo tramo transcripto del debate.",
    "Devolve SOLO las normas que realmente se estan discutiendo en ese tramo. No fuerces cruces: si el tramo no toca ninguna norma, devolve la lista vacia.",
    "Por cada norma detectada: el normId EXACTO del catalogo, un fragment textual corto del tramo que lo justifica (copiado, no parafraseado), el stance y confidence entre 0 y 1.",
    "stance: SUPPORT (se habla a favor), OPPOSE (en contra), CHANGE_REQUEST (se piden cambios concretos), MENTION (mencion o contexto).",
    "Prohibido inventar normId fuera del catalogo.",
    'Devolves EXCLUSIVAMENTE un objeto JSON valido: {"matches":[{"normId":"<id>","fragment":"<textual>","stance":"SUPPORT|OPPOSE|CHANGE_REQUEST|MENTION","confidence":0.0}]}'
  ].join("\n");

  const user = [
    "=== CATALOGO DE MININORMAS CANDIDATAS ===",
    catalog,
    "",
    "=== ULTIMO TRAMO TRANSCRIPTO ===",
    window,
    "",
    "Detecta los cruces reales y devolve el JSON pedido."
  ].join("\n");

  const response = await askUrbanAssistant(
    [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    {
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      json: true,
      temperature: 0.1,
      maxTokens: 700
    }
  );

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(response.answer);
  } catch {
    return [];
  }

  const parsed = matchOutputSchema.safeParse(rawParsed);
  if (!parsed.success) return [];

  return parsed.data.matches
    .map((match) => {
      const norm = normById.get(match.normId);
      if (!norm) return null;
      return {
        normId: norm.id,
        code: norm.code,
        title: norm.title,
        articleNumber: norm.articleNumber,
        fragment: match.fragment,
        stance: match.stance,
        confidence: match.confidence
      };
    })
    .filter((match): match is LiveMatch => match !== null);
}

/** Clave de dedupe: misma norma + fragmento casi identico en la misma audiencia. */
export function fragmentKey(projectId: string, fragment: string): string {
  const normalized = fragment.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 64);
  return `${projectId}:${normalized}`;
}

/** Claves ya persistidas de una audiencia, para deduplicar sin volver a consultar. */
export async function loadFragmentKeys(meetingId: string): Promise<Set<string>> {
  const existing = await prisma.hearingNormMatch.findMany({
    where: { meetingId },
    select: { projectId: true, fragment: true }
  });
  return new Set(existing.map((match) => fragmentKey(match.projectId, match.fragment)));
}

/**
 * Version para la ingesta batch: dedupe contra un Set en memoria que vive toda
 * la corrida y alta en un solo createMany. La del modo en vivo consulta la base
 * y crea fila por fila porque necesita devolver los ids para el panel; en batch
 * solo interesa cuantos se crearon, y hacerlo asi evita una consulta completa
 * de cruces y hasta ocho inserts sueltos POR VENTANA.
 */
export async function persistDetectedMatchesBatch(
  meetingId: string,
  detected: LiveMatch[],
  atMs: number | null,
  seen: Set<string>
): Promise<number> {
  const fresh: Prisma.HearingNormMatchCreateManyInput[] = [];
  for (const match of detected) {
    const key = fragmentKey(match.normId, match.fragment);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({
      meetingId,
      projectId: match.normId,
      fragment: match.fragment,
      stance: match.stance,
      confidence: match.confidence,
      atMs
    });
  }
  if (!fresh.length) return 0;
  const result = await prisma.hearingNormMatch.createMany({ data: fresh });
  return result.count;
}

/**
 * Persiste los cruces detectados evitando duplicados dentro de la audiencia.
 * Lo comparten la ruta live-match (modo en vivo) y el worker de ingesta batch.
 * Devuelve solo los cruces nuevos, listos para el panel.
 */
export async function persistDetectedMatches(
  meetingId: string,
  detected: LiveMatch[],
  atMs: number | null
): Promise<HearingMatchView[]> {
  if (!detected.length) return [];

  const existing = await prisma.hearingNormMatch.findMany({
    where: { meetingId },
    select: { projectId: true, fragment: true }
  });
  const seen = new Set(existing.map((match) => fragmentKey(match.projectId, match.fragment)));

  const created: HearingMatchView[] = [];
  for (const match of detected) {
    const key = fragmentKey(match.normId, match.fragment);
    if (seen.has(key)) continue;
    seen.add(key);

    const row = await prisma.hearingNormMatch.create({
      data: {
        meetingId,
        projectId: match.normId,
        fragment: match.fragment,
        stance: match.stance,
        confidence: match.confidence,
        atMs
      },
      select: { id: true, atMs: true, createdAt: true }
    });

    created.push({
      id: row.id,
      normId: match.normId,
      code: match.code,
      title: match.title,
      articleNumber: match.articleNumber,
      fragment: match.fragment,
      stance: match.stance,
      confidence: match.confidence,
      atMs: row.atMs,
      createdAt: row.createdAt.toISOString()
    });
  }

  return created;
}
