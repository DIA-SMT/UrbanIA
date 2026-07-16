import { NextResponse } from "next/server";
import { z } from "zod";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { buildMigueSystemPrompt, buildMigueUserPrompt, normalizeMigueContext } from "@/lib/ai/migue";
import { resolveAssistantAccess } from "@/lib/ai/assistant-access";
import { CHAT_BLOCK_MESSAGE, moderateChatMessage } from "@/lib/moderation";
import { analyzeAggression } from "@/lib/ai/moderation-intent";
import { analyzeMigueQuestion } from "@/lib/ai/migue-intent";
import {
  buildAnswerSource,
  buildConversationalContextBlock,
  buildRagContextBlock,
  retrieveRelevantFragments,
  type RagFragment,
  type RagRetrieval
} from "@/lib/ai/rag";
import { getNormativeExplorerData } from "@/lib/normative/data";
import { retrieveRelevantArticles } from "@/lib/normative/search";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import { attachmentSchema, buildAttachmentBlock } from "@/lib/ai/attachment";

// Igual que en la Consulta al CPU: cubre un artículo completo sin cortar filas de planillas.
const MAX_ARTICLE_CHARS = 2400;

const assistantQuerySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  context: z.string().trim().max(4000).optional(),
  attachment: attachmentSchema.nullish(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000)
      })
    )
    .max(10)
    .optional(),
  // mode y role NO se aceptan del cliente: los resuelve el servidor desde la sesion
  // (resolveAssistantAccess). Si llegan en el body, zod los descarta.
  assistantContext: z
    .object({
      module: z
        .enum([
          "landing",
          "propuestas",
          "espacios_verdes",
          "planeamiento",
          "gemelo_digital",
          "dashboard",
          "audiencias",
          "documentos",
          "asistente"
        ])
        .optional(),
      page: z.string().trim().max(120).optional(),
      intent: z.string().trim().max(160).optional()
    })
    .optional()
});

/**
 * Recuperación por palabra clave sobre los artículos del CPU (el mismo motor de la
 * Consulta al CPU), convertida a fragmentos del contrato de Migue para que la cita
 * verificable también pueda localizarse en ellos. Devuelve [] si la base no responde.
 */
async function retrieveArticleFragments(searchQuery: string): Promise<RagFragment[]> {
  try {
    const data = await getNormativeExplorerData();
    return retrieveRelevantArticles(data.articles, searchQuery, 4).map((article) => ({
      chunkId: `cpu-article-${article.number}`,
      sourceId: "codigo-planeamiento-smt-2014",
      sourceTitle: data.document.title,
      reference: `Art. ${article.number}`,
      title: article.title,
      content:
        article.content.length > MAX_ARTICLE_CHARS
          ? `${article.content.slice(0, MAX_ARTICLE_CHARS).trimEnd()} […]`
          : article.content,
      similarity: 1
    }));
  } catch (error) {
    console.warn("Article retrieval unavailable for Migue.", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Fusiona artículos por palabra clave con los fragmentos del RAG, sin duplicar artículos. */
function mergeRetrieval(retrieval: RagRetrieval, articleFragments: RagFragment[]): RagRetrieval {
  if (!articleFragments.length) {
    return retrieval;
  }

  const articleReferences = new Set(articleFragments.map((fragment) => fragment.reference));
  const fragments = [
    ...articleFragments,
    ...retrieval.fragments.filter((fragment) => !fragment.reference || !articleReferences.has(fragment.reference))
  ];

  return {
    fragments,
    sources: fragments.map((fragment) => ({
      chunkId: fragment.chunkId,
      title: fragment.title ?? fragment.sourceTitle,
      reference: fragment.reference,
      excerpt: fragment.content.replace(/\s+/g, " ").trim().slice(0, 280),
      similarity: fragment.similarity
    })),
    hasEvidence: fragments.length > 0
  };
}

function parseAssistantPayload(raw: string): { answer: string; cita: string } {
  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; cita?: unknown };

    if (parsed && typeof parsed.answer === "string") {
      return {
        answer: parsed.answer,
        cita: typeof parsed.cita === "string" ? parsed.cita : ""
      };
    }
  } catch {
    // El modelo no devolvió JSON válido: usamos el texto crudo como respuesta.
  }

  return { answer: raw, cita: "" };
}

// 10 consultas por minuto por IP: suficiente para una conversación real, corta
// cualquier script que quiera vaciar los créditos de OpenRouter.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const rate = checkRateLimit(clientKeyFromRequest(request, "assistant-query"), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Demasiadas consultas",
        detail: "Hiciste muchas consultas seguidas. Esperá un momento y volvé a intentar."
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantQuerySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Consulta invalida",
        detail: "La pregunta debe tener entre 3 y 2000 caracteres."
      },
      { status: 400 }
    );
  }

  // Dos capas: el filtro lexico corta gratis el insulto obvio, y si pasa, el
  // analisis de intencion mira si el texto agravia a alguien aunque no use ninguna
  // mala palabra ("la Dra. es una infeliz").
  const verdict = moderateChatMessage(parsed.data.question);

  if (verdict.blocked) {
    console.info("Consulta a Migue bloqueada por moderacion lexica.", { matched: verdict.matched });
    return NextResponse.json({ error: "Mensaje bloqueado", detail: verdict.message }, { status: 422 });
  }

  const aggression = await analyzeAggression(parsed.data.question);

  if (aggression.agresivo) {
    console.info("Consulta a Migue bloqueada por intencion.", { tipo: aggression.tipo });
    return NextResponse.json({ error: "Mensaje bloqueado", detail: CHAT_BLOCK_MESSAGE }, { status: 422 });
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      {
        error: "Asistente no disponible",
        detail: "El servicio de análisis todavía no está habilitado para esta instancia."
      },
      { status: 503 }
    );
  }

  try {
    // El alcance sale de la sesion: con sesion municipal, modo interno (ve actas,
    // reportes y archivos); sin sesion o como vecino, modo publico (solo normativa
    // y paginas publicas). El cliente solo aporta module/page/intent.
    const access = await resolveAssistantAccess();
    const assistantContext = normalizeMigueContext({
      ...parsed.data.assistantContext,
      mode: access.mode,
      role: access.role
    });
    const context =
      parsed.data.context ||
      "MVP con mapa urbano, propuestas, Codigo de Planeamiento, audiencias, documentos y participacion ciudadana.";
    const history = parsed.data.history ?? [];

    // Análisis de intención: clasifica si la consulta es normativa y la reescribe
    // en términos urbanísticos para que el retrieval entienda ideas informales.
    // Ante cualquier fallo cae a la consulta original sin marca normativa.
    const analysis = await analyzeMigueQuestion(parsed.data.question, history, {
      attachmentExcerpt: parsed.data.attachment?.text.slice(0, 600)
    });

    // Retrieval semántico (motor híbrido local) sobre la consulta reescrita. Si la
    // consulta es normativa, se suma la recuperación de artículos por palabra clave
    // (el mismo pipeline de la Consulta al CPU). Si falla, seguimos sin evidencia
    // para no tumbar el asistente.
    let retrieval: RagRetrieval = { fragments: [], sources: [], hasEvidence: false };
    if (!analysis.conversacion) {
      try {
        const [semanticRetrieval, articleFragments] = await Promise.all([
          retrieveRelevantFragments(analysis.consulta, {
            mode: assistantContext.mode,
            topK: analysis.normativa ? 6 : 5
          }),
          analysis.normativa ? retrieveArticleFragments(analysis.consulta) : Promise.resolve([])
        ]);
        retrieval = mergeRetrieval(semanticRetrieval, articleFragments);
      } catch (retrievalError) {
        console.error("RAG retrieval error", retrievalError);
      }
    }

    // Para charla no normativa sin evidencia, el bloque "no encontré información"
    // confunde al modelo (por ejemplo, le hace negar la memoria de conversación).
    const ragBlock =
      retrieval.hasEvidence || analysis.normativa
        ? buildRagContextBlock(retrieval)
        : buildConversationalContextBlock({ aboutConversation: analysis.conversacion });

    const extraContext = [
      ...(parsed.data.attachment ? [buildAttachmentBlock(parsed.data.attachment), ""] : []),
      ragBlock,
      "",
      "Contexto general de la plataforma:",
      context
    ].join("\n");

    // Consultas normativas o con documento adjunto: mismo modelo fuerte que la
    // Consulta al CPU (lee planillas, tablas y documentos largos con precisión).
    // El resto sigue con el modelo liviano por defecto.
    const model =
      analysis.normativa || parsed.data.attachment ? process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o" : undefined;

    const response = await askUrbanAssistant(
      [
        { role: "system", content: buildMigueSystemPrompt(assistantContext) },
        ...history.map((message) => ({
          role: message.role,
          content: message.content
        })),
        { role: "user", content: buildMigueUserPrompt(parsed.data.question, assistantContext, extraContext) }
      ],
      { json: true, model }
    );

    const { answer, cita } = parseAssistantPayload(response.answer);
    const source = buildAnswerSource(retrieval, cita);

    return NextResponse.json({ ...response, answer, source });
  } catch (error) {
    console.error("OpenRouter assistant error", error);

    return NextResponse.json(
      {
        error: "No se pudo completar el análisis",
        detail: "Intentá nuevamente o continuá con la revisión técnica manual."
      },
      { status: 502 }
    );
  }
}
