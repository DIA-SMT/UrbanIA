import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { askUrbanAssistant, hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { stanceLabels } from "@/lib/foro/shared";
import type { DebateAnalysisReport } from "@/lib/foro/data";

const bodySchema = z.object({ debateId: z.string() });

/** Lo que devuelve el modelo; se valida antes de guardar para que un JSON
 *  malformado nunca llegue a la pantalla. */
const reportSchema = z.object({
  lecturaGeneral: z.string().trim().min(1),
  coherencias: z.array(z.string().trim().min(1)).max(8),
  incongruencias: z.array(z.string().trim().min(1)).max(8),
  vacios: z.array(z.string().trim().min(1)).max(8),
  caminoConsenso: z.string().trim().nullable()
});

const SYSTEM_PROMPT = `Sos Migue, el asistente urbano de UrbanIA (Municipalidad de San Miguel de Tucumán).
Analizás la deliberación interna de un debate cerrado entre equipos técnicos municipales.
Tu devolución es un insumo de trabajo asistido: honesta, concreta y sin diplomacia vacía.
Nunca inventes argumentos que no estén en el material; si algo no se puede afirmar, no lo afirmes.
Respondé SOLO un objeto JSON con esta forma exacta:
{
  "lecturaGeneral": "2 a 4 oraciones: dónde está el peso real de la discusión y por qué (mirá las adhesiones, no solo la cantidad de argumentos).",
  "coherencias": ["punto que ambos lados comparten aunque discrepen en la solución", "..."],
  "incongruencias": ["contradicción entre argumentos o dentro de un mismo lado, nombrando a qué argumentos se refiere", "..."],
  "vacios": ["dato o información que falta y haría más sólida la decisión", "..."],
  "caminoConsenso": "si existe, una síntesis accionable que atienda las objeciones principales; si no existe, null"
}
Cada lista puede tener 0 a 5 ítems reales: no rellenes por completar. Escribí en español rioplatense, registro profesional.`;

/**
 * POST /api/debates?action=analyze. Solo administradores y solo con el debate
 * CERRADO: el informe es la devolución sobre la deliberación completa, no un
 * termómetro a mitad de discusión.
 */
export async function handleDebateAnalyze(request: Request) {
  const session = await getSessionUser();
  if (!session || !hasPermission(session, "debates.create")) {
    return NextResponse.json({ error: "Solo un administrador puede solicitar el análisis." }, { status: 403 });
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      { error: "El servicio de IA no está habilitado en esta instancia." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const debate = await prisma.debate.findUnique({
    where: { id: parsed.data.debateId },
    include: {
      meeting: { select: { title: true } },
      arguments: {
        where: { status: "VISIBLE", parentId: null },
        include: {
          author: { select: { name: true, lastName: true, occupation: true } },
          _count: { select: { supports: true } }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!debate) {
    return NextResponse.json({ error: "El debate no existe." }, { status: 404 });
  }
  if (debate.status !== "CLOSED") {
    return NextResponse.json(
      { error: "El análisis se genera con el debate cerrado: primero cerralo desde el encabezado." },
      { status: 409 }
    );
  }
  if (debate.arguments.length < 2) {
    return NextResponse.json(
      { error: "Hacen falta al menos 2 argumentos visibles para analizar la deliberación." },
      { status: 409 }
    );
  }

  const material = debate.arguments
    .map((argument, index) => {
      const author = argument.author
        ? `${argument.author.name}${argument.author.lastName ? ` ${argument.author.lastName}` : ""}${argument.author.occupation ? ` (${argument.author.occupation})` : ""}`
        : "Cuenta eliminada";
      return `[#${index + 1}] Postura: ${stanceLabels[argument.stance]} · Adhesiones: ${argument._count.supports} · Autor: ${author}\n${argument.content}`;
    })
    .join("\n\n");

  const userPrompt = `DEBATE: ${debate.title}
AUDIENCIA DE ORIGEN: ${debate.meeting?.title ?? "No registrada"}
CONTEXTO PLANTEADO: ${debate.context}

ARGUMENTOS (${debate.arguments.length}):

${material}`;

  const response = await askUrbanAssistant(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    { json: true, maxTokens: 1400, temperature: 0.3 }
  );

  let report: DebateAnalysisReport;
  try {
    report = reportSchema.parse(JSON.parse(response.answer));
  } catch (error) {
    console.error("El análisis del debate volvió malformado", error, response.answer.slice(0, 300));
    return NextResponse.json(
      { error: "El análisis volvió incompleto del modelo. Probá generarlo de nuevo." },
      { status: 502 }
    );
  }

  await prisma.debate.update({
    where: { id: debate.id },
    data: {
      analysis: report as unknown as Prisma.InputJsonValue,
      analysisAt: new Date(),
      analysisArgumentCount: debate.arguments.length,
      analysisModel: response.model
    }
  });

  return NextResponse.json({ ok: true });
}
