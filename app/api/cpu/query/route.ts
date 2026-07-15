import { NextResponse } from "next/server";
import { z } from "zod";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { getNormativeExplorerData } from "@/lib/normative/data";
import { retrieveRelevantArticles, type RetrievedArticle } from "@/lib/normative/search";
import { retrieveKnowledge, citeChunk, type RagChunk } from "@/lib/ai/rag";
import { prisma } from "@/lib/db/prisma";
import { applyOwnerCookie, resolveCpuOwner } from "@/lib/cpu/owner";
import { attachmentSchema, buildAttachmentBlock, type QueryAttachment } from "@/lib/ai/attachment";
import { analyzeMigueQuestion } from "@/lib/ai/migue-intent";

export const dynamic = "force-dynamic";

// Debe cubrir un chunk completo de planilla (hasta 2200 chars) para no cortar filas.
const MAX_ARTICLE_CHARS = 2400;
const MAX_HISTORY_MESSAGES = 8;

const cpuQuerySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  conversationId: z.string().trim().min(1).max(60).nullish(),
  attachment: attachmentSchema.nullish()
});

type DocumentRef = {
  kind: "doc";
  label: string;
  page?: number;
  source: string;
  content?: string | null;
  quote?: string | null;
};

function truncate(text: string) {
  if (text.length <= MAX_ARTICLE_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_ARTICLE_CHARS).trimEnd()} […]`;
}

function deriveTitle(question: string) {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 70 ? `${clean.slice(0, 70).trimEnd()}…` : clean;
}

function buildSystemPrompt() {
  return [
    "Sos el asistente de consulta normativa de la Municipalidad de San Miguel de Tucuman: Codigo de Planeamiento Urbano (CPU), sus Planillas y el Digesto Normativo de Catastro y Edificacion.",
    "Respondes EXCLUSIVAMENTE con base en las fuentes que el sistema te entrega en cada consulta.",
    "",
    "Reglas estrictas:",
    "- No uses conocimiento general ni normativa de otras ciudades. Solo las fuentes provistas abajo.",
    "- Nunca inventes numeros de articulo, ordenanzas, cifras, distritos ni contenido que no aparezca en las fuentes provistas.",
    "- Al citar articulos del CPU usa el formato exacto 'Articulo N' (por ejemplo: 'Articulo 45').",
    "- Al citar otras normas usa su etiqueta tal como aparece en la fuente: 'Ordenanza 1681/91', 'Ley Provincial 7500', 'Decreto 494/SSP/94', 'Planillas de Usos hoja 12/63', etc.",
    "- Si la respuesta no esta contenida en las fuentes provistas, decilo explicitamente y sugeri reformular o revisar el explorador de articulos. No completes con suposiciones.",
    "- Si las fuentes son parcialmente relevantes, responde solo lo que consta y aclara que puede faltar normativa complementaria.",
    "- Cuando la fuente sea una planilla con varias tipologias o variantes (ej. vivienda individual, colectiva entre medianeras, semi perimetro libre, perimetro libre), primero identifica EXACTAMENTE la fila/tipologia que pide la consulta y responde solo con los valores de esa fila. Nunca mezcles valores de tipologias distintas; si la consulta no distingue la tipologia, mostra cada variante por separado.",
    "- Usa el historial de la conversacion para entender referencias como 'eso' o 'ese distrito', pero segui fundamentando en las fuentes provistas.",
    "",
    "Formato de respuesta (Markdown):",
    "- Comenza con una respuesta directa y breve a la consulta.",
    "- Si corresponde, agrega puntos clave en lista.",
    "- Cerra con una linea 'Fuentes:' listando las fuentes citadas.",
    "- Tono profesional, claro y objetivo. La IA orienta; la validacion legal la hace el equipo municipal.",
    "- Recorda que los textos son los ordenados a mayo de 2014 y su vigencia posterior no esta verificada.",
    "",
    "Citas textuales (para resaltar en la interfaz de donde salio tu respuesta):",
    "- Despues de la linea 'Fuentes:', agrega UNA ultima linea con este formato exacto:",
    'CITAS_TEXTUALES: {"citas": [{"ref": "<numero de articulo (ej. 45) o etiqueta de la norma tal cual la citaste (ej. Ordenanza 1681/91, Decreto 471/SPP/94, hoja 12/63)>", "frase": "<frase copiada palabra por palabra de esa fuente en la que te apoyaste>"}]}',
    "- Una entrada por cada fuente que citaste (articulos del CPU y tambien ordenanzas, decretos, leyes o planillas). La frase debe ser copia textual de la fuente (no la parafrasees).",
    "- Si no usaste fuentes, pone una lista vacia. Esa linea se quita antes de mostrar la respuesta: no la menciones en el texto."
  ].join("\n");
}

function buildUserPrompt(
  question: string,
  articles: RetrievedArticle[],
  knowledge: RagChunk[],
  attachment?: QueryAttachment | null
) {
  const parts: string[] = ["Consulta del usuario:", question, ""];

  if (attachment) {
    parts.push(buildAttachmentBlock(attachment), "");
  }

  if (!articles.length && !knowledge.length) {
    if (attachment) {
      parts.push(
        "Fuentes normativas recuperadas para esta consulta: NINGUNA.",
        "Responde la consulta con base en el documento adjunto. Si la consulta requiere normativa que no esta en el documento, acláralo."
      );
      return parts.join("\n");
    }
    parts.push(
      "Fuentes recuperadas para esta consulta: NINGUNA.",
      "No se encontraron fuentes relevantes en la base normativa cargada. Informa que no hay base normativa para responder y sugeri reformular la consulta."
    );
    return parts.join("\n");
  }

  if (articles.length) {
    parts.push("Articulos del CPU recuperados (citalos como 'Articulo N'):", "");
    parts.push(
      articles
        .map((article) => [`### Articulo ${article.number} — ${article.title}`, truncate(article.content)].join("\n"))
        .join("\n\n")
    );
    parts.push("");
  }

  if (knowledge.length) {
    parts.push("Otras fuentes normativas recuperadas (citalas por su etiqueta):", "");
    parts.push(
      knowledge
        .map((chunk) => [`### ${citeChunk(chunk)}`, truncate(chunk.content)].join("\n"))
        .join("\n\n")
    );
    parts.push("");
  }

  parts.push("Respondé la consulta usando SOLO estas fuentes, citando articulos y normas por su etiqueta.");
  return parts.join("\n");
}

/**
 * Separa la línea CITAS_TEXTUALES del final de la respuesta. Devuelve la
 * respuesta limpia y las citas: por número de artículo (solo dígitos) y por
 * etiqueta cruda de norma (ordenanzas, decretos, planillas). Si el modelo no
 * cumplió el formato, la respuesta queda igual y no hay citas.
 */
function extractQuotesLine(rawAnswer: string): {
  answer: string;
  articleQuotes: Map<string, string>;
  labelQuotes: Array<{ ref: string; frase: string }>;
} {
  const articleQuotes = new Map<string, string>();
  const labelQuotes: Array<{ ref: string; frase: string }> = [];
  const match = rawAnswer.match(/\n?\s*CITAS_TEXTUALES:\s*(\{[\s\S]*\})\s*$/);
  if (!match) {
    return { answer: rawAnswer.trim(), articleQuotes, labelQuotes };
  }

  try {
    const parsed = JSON.parse(match[1]) as { citas?: Array<{ ref?: unknown; frase?: unknown }> };
    for (const cita of parsed.citas ?? []) {
      if (typeof cita.ref !== "string" || typeof cita.frase !== "string" || !cita.frase.trim()) continue;
      const ref = cita.ref.trim();
      // "Articulo 45", "Art. 45" o "45" → cita de artículo. El resto es una norma.
      if (/^(art[íi]culo|art\.?)?\s*n?[°º.]?\s*\d+$/iu.test(ref)) {
        articleQuotes.set(ref.replace(/\D/g, ""), cita.frase.trim());
      } else {
        labelQuotes.push({ ref, frase: cita.frase.trim() });
      }
    }
  } catch {
    // JSON malformado: seguimos sin citas, la respuesta se muestra igual.
  }

  return { answer: rawAnswer.slice(0, match.index).trim(), articleQuotes, labelQuotes };
}

/** Normaliza una etiqueta de norma para comparar ("Ordenanza N° 1.681/91" ≈ "ordenanza 1681/91"). */
function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,º°]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca la frase citada para una norma comparando etiquetas de forma laxa. */
function quoteForLabel(label: string, labelQuotes: Array<{ ref: string; frase: string }>): string | null {
  const normalized = normalizeLabel(label);
  for (const { ref, frase } of labelQuotes) {
    const normalizedRef = normalizeLabel(ref);
    if (normalized.includes(normalizedRef) || normalizedRef.includes(normalized)) {
      return frase;
    }
  }
  return null;
}

function extractCitations(answer: string, articles: RetrievedArticle[], quotes: Map<string, string>) {
  const referenced = new Set<string>();
  for (const match of answer.matchAll(/art[íi]culo[s]?\s+n?[°º.]?\s*(\d+)/giu)) {
    referenced.add(match[1]);
  }
  return articles
    .filter((article) => referenced.has(article.number))
    .map((article) => ({ number: article.number, title: article.title, quote: quotes.get(article.number) ?? null }));
}

function extractDocumentCitations(
  answer: string,
  knowledge: RagChunk[],
  labelQuotes: Array<{ ref: string; frase: string }>
): DocumentRef[] {
  const normalizedAnswer = answer.toLowerCase();
  const seen = new Set<string>();
  const references: DocumentRef[] = [];
  for (const chunk of knowledge) {
    const label = (chunk.metadata.normLabel as string) || (chunk.metadata.hoja ? `hoja ${chunk.metadata.hoja}` : "");
    if (!label || seen.has(label)) continue;
    const normId = String(chunk.metadata.normId ?? chunk.metadata.hoja ?? "");
    if (normId && (normalizedAnswer.includes(normId.toLowerCase()) || normalizedAnswer.includes(label.toLowerCase()))) {
      seen.add(label);
      references.push({
        kind: "doc",
        label: (chunk.metadata.normLabel as string) || `Planilla hoja ${chunk.metadata.hoja}`,
        page: chunk.metadata.page as number | undefined,
        source: chunk.sourceTitle,
        // El fragmento recuperado viaja con la cita para poder abrirlo inline
        // (con la frase de respaldo resaltada) sin otra consulta a la base.
        content: chunk.content,
        quote: quoteForLabel(label, labelQuotes)
      });
    }
  }
  return references;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = cpuQuerySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Consulta invalida", detail: "La pregunta debe tener entre 3 y 2000 caracteres." },
      { status: 400 }
    );
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      {
        error: "Asistente no disponible",
        detail: "El servicio de consulta al CPU todavia no esta habilitado para esta instancia."
      },
      { status: 503 }
    );
  }

  const owner = await resolveCpuOwner(true);

  let existing: { id: string; title: string } | null = null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (parsed.data.conversationId) {
    const conversation = await prisma.cpuConversation.findUnique({ where: { id: parsed.data.conversationId } });
    if (!conversation || conversation.ownerKey !== owner.ownerKey) {
      return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
    }
    existing = { id: conversation.id, title: conversation.title };
    const priorMessages = await prisma.cpuMessage.findMany({
      where: { conversationId: conversation.id, isError: false },
      orderBy: { createdAt: "asc" }
    });
    history = priorMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));
  }

  try {
    const data = await getNormativeExplorerData();

    // Mismo cerebro que Migue: el reescritor de intención convierte la pregunta
    // (informal, con referencias al historial o a un documento adjunto) en una
    // consulta de búsqueda con términos urbanísticos concretos.
    let focusedQuery: string | null = null;
    const analysis = await analyzeMigueQuestion(parsed.data.question, history, {
      attachmentExcerpt: parsed.data.attachment?.text.slice(0, 600)
    });
    if (analysis.consulta.trim() && analysis.consulta.trim() !== parsed.data.question) {
      focusedQuery = analysis.consulta.trim();
    }

    const articles = retrieveRelevantArticles(data.articles, focusedQuery ?? parsed.data.question, 5);

    // RAG documental (digesto, planillas, anexo). Si la base vectorial no está lista, seguimos solo con artículos.
    let knowledge: RagChunk[] = [];
    try {
      const articleNumbers = new Set(articles.map((article) => article.number));
      const [primary, focused] = await Promise.all([
        retrieveKnowledge(parsed.data.question, 8),
        focusedQuery ? retrieveKnowledge(focusedQuery, 6) : Promise.resolve([] as RagChunk[])
      ]);
      const seen = new Set<string>();
      knowledge = [...focused, ...primary]
        .filter((chunk) => {
          if (seen.has(chunk.chunkId)) return false;
          seen.add(chunk.chunkId);
          return !chunk.metadata.articleNumber || !articleNumbers.has(String(chunk.metadata.articleNumber));
        })
        .slice(0, focusedQuery ? 8 : 6);
    } catch (error) {
      console.warn("RAG retrieval unavailable, falling back to keyword articles.", error instanceof Error ? error.message : error);
    }

    // Modelo más capaz para la consulta normativa: leer tablas (planillas) con
    // precisión supera a gpt-4o-mini; configurable vía OPENROUTER_CPU_MODEL.
    const response = await askUrbanAssistant(
      [
        { role: "system", content: buildSystemPrompt() },
        ...history,
        { role: "user", content: buildUserPrompt(parsed.data.question, articles, knowledge, parsed.data.attachment) }
      ],
      { model: process.env.OPENROUTER_CPU_MODEL || "openai/gpt-4o" }
    );

    const { answer, articleQuotes, labelQuotes } = extractQuotesLine(response.answer);
    const citations = extractCitations(answer, articles, articleQuotes);
    const documents = extractDocumentCitations(answer, knowledge, labelQuotes);
    const retrievedSummary = articles.map((article) => ({ number: article.number, title: article.title }));
    const retrievedForStorage = [...retrievedSummary, ...documents];

    const persisted = await prisma.$transaction(async (tx) => {
      let conversationId = existing?.id;
      let title = existing?.title;

      if (!conversationId) {
        const created = await tx.cpuConversation.create({
          data: { title: deriveTitle(parsed.data.question), ownerKey: owner.ownerKey, userId: owner.userId }
        });
        conversationId = created.id;
        title = created.title;
      } else {
        const bumped = await tx.cpuConversation.update({ where: { id: conversationId }, data: { title } });
        title = bumped.title;
      }

      const userContent = parsed.data.attachment
        ? `${parsed.data.question}\n\n[Archivo adjuntado: ${parsed.data.attachment.name}]`
        : parsed.data.question;
      await tx.cpuMessage.create({
        data: { conversationId, role: "user", content: userContent }
      });
      await tx.cpuMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: answer,
          citations,
          retrieved: retrievedForStorage
        }
      });

      return { conversationId, title: title ?? deriveTitle(parsed.data.question) };
    });

    const jsonResponse = NextResponse.json({
      conversationId: persisted.conversationId,
      title: persisted.title,
      answer,
      model: response.model,
      provider: response.provider,
      citations,
      documents,
      retrieved: retrievedSummary
    });

    return applyOwnerCookie(jsonResponse, owner);
  } catch (error) {
    console.error("CPU query error", error);

    return NextResponse.json(
      {
        error: "No se pudo completar la consulta",
        detail: "Intenta nuevamente o revisa los articulos del Codigo en el explorador."
      },
      { status: 502 }
    );
  }
}
