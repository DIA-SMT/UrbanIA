import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { askUrbanAssistant, hasOpenRouterConfig, type UrbanAssistantMessage } from "@/lib/ai/openrouter";
import { getNormativeExplorerData, type NormativeExplorerArticle } from "@/lib/normative/data";
import { retrieveRelevantArticles } from "@/lib/normative/search";
import { getNormAnchors } from "@/lib/projects/data";
import {
  materiaLabels,
  relationshipTypeLabels,
  type ProjectAnchorView,
  type ProjectDiagnosisView
} from "@/lib/projects/shared";

/**
 * IA de la Fabrica de Normas, en dos pasos:
 *
 * 1. formalizeNorm: convierte el objeto escrito en crudo en el texto formal del
 *    articulado, usando el CPU 2014 solo como referencia de estilo/terminologia.
 * 2. compareNormWithOldCode: con la norma ya formalizada, detecta que articulos
 *    del CPU 2014 toca, les asigna la relacion, los ancla automaticamente
 *    (createdBy: "ia", sin pisar los anclajes humanos) y produce el analisis de
 *    impacto con recomendaciones y conflictos.
 *
 * La IA orienta; el humano revisa los anclajes y es el autor final del texto.
 */

/** Se lanza cuando falta la config de IA; la API la mapea a 503. */
export class DiagnosisUnavailableError extends Error {
  constructor() {
    super("OPENROUTER_NOT_CONFIGURED");
    this.name = "DiagnosisUnavailableError";
  }
}

/** Se lanza al comparar sin texto formalizado; la API la mapea a 422. */
export class MissingArticleTextError extends Error {
  constructor() {
    super("ARTICLE_TEXT_REQUIRED");
    this.name = "MissingArticleTextError";
  }
}

const AI_ANCHOR_AUTHOR = "ia";
const MAX_CANDIDATE_CHARS = 2200;
const MAX_STYLE_CHARS = 1400;

const AI_MODEL = () => process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o";

type CandidateArticle = {
  article: NormativeExplorerArticle;
  /** Relacion ya marcada a mano por un humano, si existe. */
  manualRelationship: string | null;
  manualNotes: string | null;
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()} […]` : text;
}

function normalizeForQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/* ------------------------------ Paso 1 ----------------------------------- */

const formalizeOutputSchema = z.object({
  proposedText: z.string().trim().min(1).max(20000)
});

export type FormalizeResult = { proposedText: string; model: string | null };

function buildFormalizationPrompt(params: {
  norm: { title: string; articleNumber: string | null; summary: string; articleText: string | null; materiaLabel: string };
  styleArticles: NormativeExplorerArticle[];
}): UrbanAssistantMessage[] {
  const { norm, styleArticles } = params;

  const system = [
    "Sos redactor normativo del area de Planeamiento de la Municipalidad de San Miguel de Tucuman.",
    "Tu unica tarea es FORMALIZAR: convertir el objeto de una norma, escrito en crudo por el analista, en el texto formal de un articulo para el codigo de planeamiento nuevo.",
    "",
    "Reglas:",
    "- Estilo de articulado: numerado, lenguaje normativo, redaccion prescriptiva, en la terminologia del CPU 2014 que se te pasa como referencia de estilo.",
    "- NO marques relaciones con el codigo viejo, NO cites conflictos, NO listes articulos afectados: eso es otro paso del flujo.",
    "- Si el analista ya escribio un borrador de articulado, tomalo como base y mejoralo sin cambiarle el sentido.",
    "- No inventes referencias a ordenanzas ni a articulos concretos del codigo viejo.",
    "",
    "Devolves EXCLUSIVAMENTE un objeto JSON valido con esta forma exacta:",
    '{"proposedText":"<texto formal del articulado>"}',
    "Espanol rioplatense institucional. La sugerencia es editable: el equipo municipal redacta la version final."
  ].join("\n");

  const styleBlock = styleArticles.length
    ? styleArticles
        .map((article) => [`### Articulo ${article.number} — ${article.title}`, truncate(article.content, MAX_STYLE_CHARS)].join("\n"))
        .join("\n\n")
    : "Sin articulos de referencia disponibles.";

  const user = [
    "NORMA A FORMALIZAR",
    `Titulo: ${norm.title}`,
    norm.articleNumber ? `Numero tentativo dentro del codigo nuevo: ${norm.articleNumber}` : "Sin numero tentativo asignado.",
    `Materia: ${norm.materiaLabel || "sin especificar"}`,
    "",
    "Objeto escrito en crudo por el analista:",
    norm.summary,
    "",
    norm.articleText?.trim()
      ? ["Borrador de articulado ya escrito por el equipo (usalo como base):", norm.articleText].join("\n")
      : "Todavia no hay borrador de articulado.",
    "",
    "=== CPU 2014 — REFERENCIA DE ESTILO Y TERMINOLOGIA (no marcar relaciones) ===",
    styleBlock,
    "",
    "Formaliza el articulado en el JSON pedido."
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

/**
 * Paso 1: formaliza el objeto en texto de articulado. No persiste nada: el
 * texto recien se guarda cuando el analista lo lleva a articleText.
 */
export async function formalizeNorm(normId: string): Promise<FormalizeResult> {
  if (!hasOpenRouterConfig()) {
    throw new DiagnosisUnavailableError();
  }

  const norm = await prisma.project.findUnique({
    where: { id: normId },
    select: { title: true, summary: true, areas: true, articleNumber: true, articleText: true }
  });
  if (!norm) {
    throw new Error("Norma no encontrada");
  }

  const normativeData = await getNormativeExplorerData();
  const styleArticles = retrieveRelevantArticles(normativeData.articles, [norm.title, norm.summary].join(" "), 5)
    .map((retrieved) => normativeData.articles.find((article) => article.id === retrieved.id))
    .filter((article): article is NormativeExplorerArticle => Boolean(article));

  const materiaLabel = norm.areas.map((area) => materiaLabels[area]).join(", ");

  const messages = buildFormalizationPrompt({
    norm: {
      title: norm.title,
      articleNumber: norm.articleNumber,
      summary: norm.summary,
      articleText: norm.articleText,
      materiaLabel
    },
    styleArticles
  });

  const response = await askUrbanAssistant(messages, {
    model: AI_MODEL(),
    json: true,
    temperature: 0.2,
    maxTokens: 1600
  });

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(response.answer);
  } catch {
    throw new Error("La IA no devolvio un JSON valido para la formalizacion");
  }

  const parsed = formalizeOutputSchema.safeParse(rawParsed);
  if (!parsed.success) {
    throw new Error("La formalizacion de la IA no cumple el formato esperado");
  }

  return { proposedText: parsed.data.proposedText, model: response.model };
}

/* ------------------------------ Paso 2 ----------------------------------- */

const touchedRelationshipValues = ["MODIFIES", "REPEALS", "REPLACES", "REFERENCES", "POTENTIAL_CONFLICT", "APPLIES"] as const;

const comparisonOutputSchema = z.object({
  feasibility: z.enum(["HIGH", "MEDIUM", "LOW", "BLOCKED"]),
  scope: z.string().trim().min(1).max(400),
  objective: z.string().trim().min(1).max(800),
  analysis: z.string().trim().min(1),
  actions: z.array(z.string().trim().min(1)).max(12).default([]),
  risks: z.array(z.string().trim().min(1)).max(12).default([]),
  touchedArticles: z
    .array(
      z.object({
        articleId: z.string().trim(),
        articleNumber: z.string().trim(),
        relationshipType: z.enum(touchedRelationshipValues),
        note: z.string().trim().min(1).max(600)
      })
    )
    .max(20)
    .default([]),
  citedArticles: z
    .array(z.object({ articleId: z.string().trim(), articleNumber: z.string().trim(), quote: z.string().trim().min(1) }))
    .max(20)
    .default([])
});

export type ComparisonResult = { diagnosis: ProjectDiagnosisView; anchors: ProjectAnchorView[] };

function buildComparisonPrompt(params: {
  norm: { title: string; articleNumber: string | null; summary: string; articleText: string; materiaLabel: string };
  candidates: CandidateArticle[];
}): UrbanAssistantMessage[] {
  const { norm, candidates } = params;

  const system = [
    "Sos analista tecnico-juridico del area de Planeamiento de la Municipalidad de San Miguel de Tucuman.",
    "Recibis una norma YA FORMALIZADA para el codigo de planeamiento nuevo y un conjunto de articulos CANDIDATOS del CPU 2014 (el codigo viejo).",
    "",
    "Tu trabajo:",
    "1. Identificar SOLO los articulos candidatos que la norma nueva realmente toca. No fuerces relaciones donde no las hay: si un candidato no es alcanzado por la norma, no lo incluyas.",
    "2. Para cada articulo tocado, asignar la relacion exacta: MODIFIES (lo modifica parcialmente), REPEALS (lo deroga), REPLACES (lo reemplaza o sustituye por completo), REFERENCES (lo refiere como contexto), POTENTIAL_CONFLICT (posible contradiccion a revisar), o APPLIES (regula directamente la misma situacion). Acompanala con una nota corta que explique QUE toca de ese articulo.",
    "3. Elaborar el analisis de impacto ('analysis': que toca, que conflictos genera, que vacios deja), las recomendaciones operativas ('actions', ej. 'derogar expresamente el Art. 45') y los conflictos concretos con lo vigente ('risks').",
    "",
    "Reglas estrictas:",
    "- Esta PROHIBIDO marcar o citar articulos que no esten entre los candidatos provistos. No inventes numeros, ordenanzas ni contenido.",
    "- Algunos candidatos ya tienen un anclaje manual del analista (se indica con su relacion y nota): consideralos si o si en el analisis, pero respeta la relacion que marco el humano.",
    "- 'feasibility' es el nivel de conflicto normativo: HIGH = sin conflictos, lista para avanzar; MEDIUM = ajustes menores; LOW = conflictos relevantes; BLOCKED = choca de fondo con el codigo vigente.",
    "- 'quote' de citedArticles debe ser un fragmento TEXTUAL copiado del contenido del articulo, no una parafrasis.",
    "- Si falta base normativa para concluir, decilo explicitamente en 'analysis' y baja 'feasibility'.",
    "",
    "Devolves EXCLUSIVAMENTE un objeto JSON valido con esta forma exacta:",
    '{"feasibility":"HIGH|MEDIUM|LOW|BLOCKED","scope":"ambito de aplicacion","objective":"objeto de la norma","analysis":"impacto sobre el codigo viejo","actions":["recomendacion"],"risks":["conflicto concreto"],"touchedArticles":[{"articleId":"<id de un candidato>","articleNumber":"<numero>","relationshipType":"MODIFIES|REPEALS|REPLACES|REFERENCES|POTENTIAL_CONFLICT|APPLIES","note":"<que toca>"}],"citedArticles":[{"articleId":"<id>","articleNumber":"<numero>","quote":"<fragmento textual>"}]}',
    "Espanol rioplatense institucional. La IA orienta; el equipo municipal valida cada anclaje."
  ].join("\n");

  const candidatesBlock = candidates.length
    ? candidates
        .map((candidate) =>
          [
            `### Articulo ${candidate.article.number} — ${candidate.article.title} [articleId: ${candidate.article.id}]`,
            candidate.manualRelationship
              ? `Anclaje manual existente del analista: ${candidate.manualRelationship}${candidate.manualNotes ? ` — ${candidate.manualNotes}` : ""}`
              : null,
            truncate(candidate.article.content, MAX_CANDIDATE_CHARS)
          ]
            .filter((line): line is string => line !== null)
            .join("\n")
        )
        .join("\n\n")
    : "Sin articulos candidatos recuperados.";

  const user = [
    "NORMA FORMALIZADA (para el codigo nuevo)",
    `Titulo: ${norm.title}`,
    norm.articleNumber ? `Numero tentativo: ${norm.articleNumber}` : "Sin numero tentativo asignado.",
    `Materia: ${norm.materiaLabel || "sin especificar"}`,
    "Objeto:",
    norm.summary,
    "",
    "Texto del articulado:",
    norm.articleText,
    "",
    "=== CPU 2014 — ARTICULOS CANDIDATOS ===",
    candidatesBlock,
    "",
    "Compara la norma contra los candidatos y devolve el JSON pedido, marcando y citando solo articulos de este contexto."
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

/**
 * Paso 2: compara la norma formalizada contra el CPU 2014, ancla los articulos
 * detectados (createdBy: "ia") sin pisar los anclajes humanos, y persiste el
 * analisis de impacto versionado.
 */
export async function compareNormWithOldCode(normId: string): Promise<ComparisonResult> {
  if (!hasOpenRouterConfig()) {
    throw new DiagnosisUnavailableError();
  }

  const norm = await prisma.project.findUnique({
    where: { id: normId },
    select: { title: true, summary: true, areas: true, articleNumber: true, articleText: true }
  });
  if (!norm) {
    throw new Error("Norma no encontrada");
  }
  if (!norm.articleText || !norm.articleText.trim()) {
    throw new MissingArticleTextError();
  }
  const articleText = norm.articleText;

  const [normativeData, existingLinks] = await Promise.all([
    getNormativeExplorerData(),
    prisma.normativeLink.findMany({ where: { sourceType: "project", sourceId: normId } })
  ]);
  const articleById = new Map(normativeData.articles.map((article) => [article.id, article]));

  // Candidatos: recuperados por relevancia + los anclados a mano por un humano
  // (estos entran si o si para que la IA los considere).
  const manualLinks = existingLinks.filter((link) => link.createdBy !== AI_ANCHOR_AUTHOR);
  const manualByArticleId = new Map(manualLinks.map((link) => [link.articleId, link]));

  const retrieved = retrieveRelevantArticles(
    normativeData.articles,
    [norm.title, norm.summary, articleText].join(" "),
    12
  );

  const candidateIds = new Set<string>();
  const candidates: CandidateArticle[] = [];

  const pushCandidate = (articleId: string) => {
    if (candidateIds.has(articleId)) return;
    const article = articleById.get(articleId);
    if (!article) return;
    const manual = manualByArticleId.get(articleId);
    candidateIds.add(articleId);
    candidates.push({
      article,
      manualRelationship: manual ? relationshipTypeLabels[manual.relationshipType] : null,
      manualNotes: manual?.notes ?? null
    });
  };

  retrieved.forEach((article) => pushCandidate(article.id));
  manualLinks.forEach((link) => pushCandidate(link.articleId));

  const materiaLabel = norm.areas.map((area) => materiaLabels[area]).join(", ");

  const messages = buildComparisonPrompt({
    norm: {
      title: norm.title,
      articleNumber: norm.articleNumber,
      summary: norm.summary,
      articleText,
      materiaLabel
    },
    candidates
  });

  const response = await askUrbanAssistant(messages, {
    model: AI_MODEL(),
    json: true,
    temperature: 0.2,
    maxTokens: 2400
  });

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(response.answer);
  } catch {
    throw new Error("La IA no devolvio un JSON valido para la comparacion");
  }

  const parsed = comparisonOutputSchema.safeParse(rawParsed);
  if (!parsed.success) {
    throw new Error("La comparacion de la IA no cumple el formato esperado");
  }

  // Solo articulos del contexto: se descartan detecciones fuera de los candidatos.
  const validTouched = parsed.data.touchedArticles.filter((touched) => candidateIds.has(touched.articleId));

  // Validacion de citas: articleId en contexto y quote textual.
  const contextContentById = new Map<string, string>();
  candidates.forEach((candidate) => contextContentById.set(candidate.article.id, normalizeForQuote(candidate.article.content)));

  const validCitations = parsed.data.citedArticles.filter((citation) => {
    const normalizedContent = contextContentById.get(citation.articleId);
    if (!normalizedContent) return false;
    return normalizedContent.includes(normalizeForQuote(citation.quote));
  });

  // Anclaje automatico. Los anclajes humanos nunca se tocan; si un articulo ya
  // tiene anclaje manual, se respeta la relacion del humano (no se duplica con
  // la de la IA).
  const aiTouched = validTouched.filter((touched) => !manualByArticleId.has(touched.articleId));
  const newAiKeys = new Set(aiTouched.map((touched) => `${touched.articleId}-${touched.relationshipType}`));

  const staleAiLinks = existingLinks.filter(
    (link) => link.createdBy === AI_ANCHOR_AUTHOR && !newAiKeys.has(`${link.articleId}-${link.relationshipType}`)
  );
  if (staleAiLinks.length) {
    await prisma.normativeLink.deleteMany({ where: { id: { in: staleAiLinks.map((link) => link.id) } } });
  }

  for (const touched of aiTouched) {
    await prisma.normativeLink.upsert({
      where: {
        sourceType_sourceId_articleId_relationshipType: {
          sourceType: "project",
          sourceId: normId,
          articleId: touched.articleId,
          relationshipType: touched.relationshipType
        }
      },
      update: { notes: touched.note, createdBy: AI_ANCHOR_AUTHOR },
      create: {
        sourceType: "project",
        sourceId: normId,
        articleId: touched.articleId,
        relationshipType: touched.relationshipType,
        notes: touched.note,
        createdBy: AI_ANCHOR_AUTHOR
      }
    });
  }

  const lastVersion = await prisma.projectDiagnosis.findFirst({
    where: { projectId: normId },
    orderBy: { version: "desc" },
    select: { version: true }
  });

  const created = await prisma.projectDiagnosis.create({
    data: {
      projectId: normId,
      version: (lastVersion?.version ?? 0) + 1,
      feasibility: parsed.data.feasibility,
      scope: parsed.data.scope,
      objective: parsed.data.objective,
      analysis: parsed.data.analysis,
      actions: parsed.data.actions,
      risks: parsed.data.risks,
      citedArticles: validCitations,
      model: response.model
    }
  });

  const diagnosis: ProjectDiagnosisView = {
    id: created.id,
    version: created.version,
    feasibility: created.feasibility,
    scope: created.scope,
    objective: created.objective,
    analysis: created.analysis,
    actions: parsed.data.actions,
    risks: parsed.data.risks,
    citedArticles: validCitations,
    proposedText: created.proposedText,
    model: created.model,
    editedByHuman: created.editedByHuman,
    createdAt: created.createdAt.toISOString()
  };

  const anchors = await getNormAnchors(normId);

  return { diagnosis, anchors };
}
