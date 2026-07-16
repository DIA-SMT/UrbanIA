import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

// Motivos que ofrece la UI para votos negativos. Se validan acá para que el
// endpoint público no acepte texto arbitrario en un campo pensado para agrupar.
const FEEDBACK_REASONS = [
  "no_responde",
  "fuente_no_coincide",
  "desactualizada"
] as const;

const feedbackSchema = z.object({
  rating: z.enum(["up", "down"]),
  reason: z.enum(FEEDBACK_REASONS).nullish(),
  comment: z.string().trim().max(1000).nullish(),
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(8000),
  sourceReference: z.string().trim().max(200).nullish(),
  model: z.string().trim().max(120).nullish()
});

const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(request: Request) {
  const rate = checkRateLimit(clientKeyFromRequest(request, "assistant-feedback"), RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados envíos", detail: "Esperá un momento antes de enviar más opiniones." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Feedback invalido", detail: "No se pudo registrar la opinión." },
      { status: 400 }
    );
  }

  try {
    await prisma.migueFeedback.create({
      data: {
        rating: parsed.data.rating,
        reason: parsed.data.rating === "down" ? parsed.data.reason ?? null : null,
        comment: parsed.data.comment || null,
        question: parsed.data.question,
        answer: parsed.data.answer,
        sourceReference: parsed.data.sourceReference || null,
        model: parsed.data.model || null
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Migue feedback error", error);
    return NextResponse.json(
      { error: "No se pudo registrar la opinión", detail: "Intentá nuevamente en unos minutos." },
      { status: 502 }
    );
  }
}
