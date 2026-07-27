import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeHearingTranscript } from "@/lib/hearings/analyze";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Cada analisis manda hasta 60k caracteres al modelo: se cobra por llamada. */
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const requestSchema = z.object({
  transcript: z.string().trim().min(20).max(60000),
  context: z
    .object({
      title: z.string().max(200).optional(),
      mainTopic: z.string().max(160).optional(),
      relatedProposal: z.string().max(240).optional(),
      relatedArticles: z.array(z.string().max(80)).max(20).optional()
    })
    .optional()
});

export async function POST(request: Request) {
  // Analizar una transcripcion cuesta plata real por llamada: sin sesion
  // municipal no se atiende, y aun con ella hay tope por minuto. Es el mismo
  // criterio de /api/hearings/[id]/analyze y de las rutas del asistente.
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const rate = checkRateLimit(clientKeyFromRequest(request, "analyze-transcript"), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados analisis", detail: "Esperá un momento antes de analizar otra transcripción." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Transcripcion invalida" }, { status: 400 });
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json({ error: "Migue no esta configurado para analizar transcripciones." }, { status: 503 });
  }

  try {
    const { draft, model, provider } = await analyzeHearingTranscript(parsed.data.transcript, parsed.data.context ?? {});
    return NextResponse.json({ draft, model, provider });
  } catch (error) {
    console.error("Unable to analyze hearing transcript.", error);
    return NextResponse.json({ error: "No pudimos generar el borrador con Migue." }, { status: 502 });
  }
}
