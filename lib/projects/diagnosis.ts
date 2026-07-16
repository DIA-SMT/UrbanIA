import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { askUrbanAssistant, hasOpenRouterConfig, type UrbanAssistantMessage } from "@/lib/ai/openrouter";
import { getNormativeExplorerData, type NormativeExplorerArticle } from "@/lib/normative/data";
import { retrieveRelevantArticles } from "@/lib/normative/search";
import { getProjectAnchors } from "@/lib/projects/data";
import { municipalAreaLabels, relationshipTypeLabels, type ProjectDiagnosisView } from "@/lib/projects/shared";
import type { NormativeRelationshipType } from "@prisma/client";

/** Se lanza cuando falta la config de IA; la API la mapea a 503. */
export class DiagnosisUnavailableError extends Error {
  constructor() {
    super("OPENROUTER_NOT_CONFIGURED");
    this.name = "DiagnosisUnavailableError";
  }
}

const MAX_ANCHOR_CHARS = 3000;
const MAX_COMPLEMENTARY_CHARS = 1200;

type AnchoredArticle = {
  article: NormativeExplorerArticle;
  relationshipType: NormativeRelationshipType;
  notes: string | null;
};

type ComplementaryArticle = { id: string; number: string; title: string; content: string };

const diagnosisOutputSchema = z.object({
  feasibility: z.enum(["HIGH", "MEDIUM", "LOW", "BLOCKED"]),
  scope: z.string().trim().min(1).max(400),
  objective: z.string().trim().min(1).max(800),
  analysis: z.string().trim().min(1),
  actions: z.array(z.string().trim().min(1)).max(12).default([]),
  risks: z.array(z.string().trim().min(1)).max(12).default([]),
  citedArticles: z
    .array(z.object({ articleId: z.string().trim(), articleNumber: z.string().trim(), quote: z.string().trim().min(1) }))
    .max(20)
    .default([])
});

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()} […]` : text;
}

function normalizeForQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function buildDiagnosisPrompt(params: {
  project: { title: string; summary: string; areasLabel: string };
  anchoredArticles: AnchoredArticle[];
  complementaryArticles: ComplementaryArticle[];
}): UrbanAssistantMessage[] {
  const { project, anchoredArticles, complementaryArticles } = params;

  const system = [
    "Sos analista tecnico-urbano de la Municipalidad de San Miguel de Tucuman.",
    "Elaboras un diagnostico tecnico de viabilidad para un proyecto urbano.",
    "Fundas CADA afirmacion normativa unica y exclusivamente en los articulos que se te entregan en este mensaje.",
    "",
    "Reglas estrictas:",
    "- Esta PROHIBIDO citar articulos que no figuren en el contexto provisto. No inventes numeros, ordenanzas ni contenido.",
    "- Los articulos ANCLADOS son la fuente prioritaria y de cita obligatoria. Cada uno viene con una intencion de anclaje (relationshipType): 'Aplica' significa que regula directamente el proyecto; 'Posible conflicto' significa que el proyecto podria contradecirlo (leelo con ojo critico); 'Requiere revision' que hay que chequearlo; 'Modifica', 'Refiere' y 'Respalda' segun corresponda. Interpretalos segun esa intencion.",
    "- Los articulos COMPLEMENTARIOS son referencia secundaria recuperada por busqueda; usalos solo si son pertinentes.",
    "- Si falta informacion normativa para concluir, decilo explicitamente en 'analysis' y baja la factibilidad ('feasibility').",
    "- 'quote' debe ser un fragmento TEXTUAL copiado del contenido del articulo citado, no una parafrasis.",
    "",
    "Devolves EXCLUSIVAMENTE un objeto JSON valido con esta forma exacta:",
    '{"feasibility":"HIGH|MEDIUM|LOW|BLOCKED","scope":"ambito de intervencion","objective":"objetivo del proyecto","analysis":"analisis fundamentado","actions":["accion recomendada"],"risks":["riesgo"],"citedArticles":[{"articleId":"<id exacto del articulo del contexto>","articleNumber":"<numero>","quote":"<fragmento textual>"}]}',
    "Tono profesional, claro y en espanol rioplatense institucional. La IA orienta; el equipo municipal valida."
  ].join("\n");

  const anchoredBlock = anchoredArticles.length
    ? anchoredArticles
        .map((entry) =>
          [
            `### Articulo ${entry.article.number} — ${entry.article.title} [articleId: ${entry.article.id}]`,
            `Intencion de anclaje: ${relationshipTypeLabels[entry.relationshipType]}${entry.notes ? ` — Nota del analista: ${entry.notes}` : ""}`,
            truncate(entry.article.content, MAX_ANCHOR_CHARS)
          ].join("\n")
        )
        .join("\n\n")
    : "No hay articulos anclados por el analista.";

  const complementaryBlock = complementaryArticles.length
    ? complementaryArticles
        .map((article) => [`### Articulo ${article.number} — ${article.title} [articleId: ${article.id}]`, truncate(article.content, MAX_COMPLEMENTARY_CHARS)].join("\n"))
        .join("\n\n")
    : "Sin articulos complementarios recuperados.";

  const user = [
    "PROYECTO A DIAGNOSTICAR",
    `Titulo: ${project.title}`,
    `Areas municipales involucradas: ${project.areasLabel || "sin especificar"}`,
    "Descripcion (hechos cargados por el equipo):",
    project.summary,
    "",
    "=== NORMATIVA ANCLADA (fuente prioritaria, cita obligatoria) ===",
    anchoredBlock,
    "",
    "=== NORMATIVA COMPLEMENTARIA (referencia secundaria) ===",
    complementaryBlock,
    "",
    "Elabora el diagnostico tecnico en el JSON pedido, citando solo articulos de este contexto."
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

/**
 * Orquesta el diagnostico IA de un proyecto y persiste una nueva version.
 * Ancla la normativa marcada por el usuario (fuente prioritaria) y complementa
 * con busqueda por palabra clave sobre el CPU.
 */
export async function generateProjectDiagnosis(projectId: string): Promise<ProjectDiagnosisView> {
  if (!hasOpenRouterConfig()) {
    throw new DiagnosisUnavailableError();
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true, summary: true, areas: true }
  });
  if (!project) {
    throw new Error("Proyecto no encontrado");
  }

  const [anchors, normativeData] = await Promise.all([getProjectAnchors(projectId), getNormativeExplorerData()]);
  const articleById = new Map(normativeData.articles.map((article) => [article.id, article]));

  const anchoredArticles: AnchoredArticle[] = anchors
    .map((anchor) => {
      const article = articleById.get(anchor.articleId);
      return article ? { article, relationshipType: anchor.relationshipType, notes: anchor.notes } : null;
    })
    .filter((entry): entry is AnchoredArticle => entry !== null);

  const anchoredIds = new Set(anchoredArticles.map((entry) => entry.article.id));
  const complementaryArticles: ComplementaryArticle[] = retrieveRelevantArticles(normativeData.articles, project.summary, 6)
    .filter((article) => !anchoredIds.has(article.id))
    .map((article) => ({ id: article.id, number: article.number, title: article.title, content: article.content }));

  const areasLabel = project.areas.map((area) => municipalAreaLabels[area]).join(", ");

  const messages = buildDiagnosisPrompt({
    project: { title: project.title, summary: project.summary, areasLabel },
    anchoredArticles,
    complementaryArticles
  });

  const response = await askUrbanAssistant(messages, {
    model: process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o",
    json: true,
    temperature: 0.2,
    maxTokens: 1600
  });

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(response.answer);
  } catch {
    throw new Error("La IA no devolvio un JSON valido para el diagnostico");
  }

  const parsed = diagnosisOutputSchema.safeParse(rawParsed);
  if (!parsed.success) {
    throw new Error("El diagnostico de la IA no cumple el formato esperado");
  }

  // Validacion de citas: articleId debe estar en el contexto y el quote debe
  // aparecer textualmente en el contenido del articulo. Se descartan las invalidas.
  const contextContentById = new Map<string, string>();
  anchoredArticles.forEach((entry) => contextContentById.set(entry.article.id, normalizeForQuote(entry.article.content)));
  complementaryArticles.forEach((article) => contextContentById.set(article.id, normalizeForQuote(article.content)));

  const validCitations = parsed.data.citedArticles.filter((citation) => {
    const normalizedContent = contextContentById.get(citation.articleId);
    if (!normalizedContent) return false;
    return normalizedContent.includes(normalizeForQuote(citation.quote));
  });

  const lastVersion = await prisma.projectDiagnosis.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true }
  });

  const created = await prisma.projectDiagnosis.create({
    data: {
      projectId,
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

  return {
    id: created.id,
    version: created.version,
    feasibility: created.feasibility,
    scope: created.scope,
    objective: created.objective,
    analysis: created.analysis,
    actions: parsed.data.actions,
    risks: parsed.data.risks,
    citedArticles: validCitations,
    model: created.model,
    editedByHuman: created.editedByHuman,
    createdAt: created.createdAt.toISOString()
  };
}
