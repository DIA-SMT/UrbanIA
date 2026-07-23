import { NextResponse } from "next/server";
import { z } from "zod";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeHearingTranscript } from "@/lib/hearings/analyze";

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
