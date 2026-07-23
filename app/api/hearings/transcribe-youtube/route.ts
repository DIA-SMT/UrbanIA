import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAssistantAccess } from "@/lib/ai/assistant-access";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { saveHearingTranscript } from "@/lib/hearings/persist-transcript";
import { canonicalYoutubeUrl, transcribeYoutubeHearing } from "@/lib/hearings/youtube-transcript";

/** Una audiencia de una hora tarda ~2 min: descarga, 14 tramos y la pasada de nombres. */
export const maxDuration = 300;

const requestSchema = z.object({
  url: z.string().trim().min(10).max(300)
});

export async function POST(request: Request) {
  // Transcribir cuesta plata real por llamada y ejecuta binarios en el servidor:
  // sin sesion municipal no se atiende. El rol sale de la cookie, nunca del body.
  const access = await resolveAssistantAccess();

  if (!access.isStaff) {
    return NextResponse.json({ error: "Necesitas una sesion municipal para transcribir una audiencia." }, { status: 401 });
  }

  if (!hasOpenRouterConfig()) {
    return NextResponse.json({ error: "Falta configurar OPENROUTER_API_KEY en el servidor." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Falta el link del video." }, { status: 400 });
  }

  if (!canonicalYoutubeUrl(parsed.data.url)) {
    return NextResponse.json({ error: "El link no parece un video de YouTube valido." }, { status: 400 });
  }

  try {
    const result = await transcribeYoutubeHearing(parsed.data.url);

    if (!result.transcript.trim()) {
      return NextResponse.json({ error: "El video se descargo pero no se obtuvo texto." }, { status: 502 });
    }

    const identificados = result.speakers.filter((s) => s.name).length;

    // La transcripcion cuesta plata: se guarda en el servidor apenas existe, para
    // que no viva solo en el navegador de quien la pidio. Si la base falla, el
    // texto igual vuelve al usuario: perder el artefacto pagado por un error de
    // persistencia seria peor que devolverlo sin guardar.
    let meetingId: string | null = null;
    try {
      meetingId = await saveHearingTranscript({
        sourceUrl: result.sourceUrl,
        title: result.videoTitle,
        durationSec: result.durationSec,
        costUsd: result.costUsd,
        truncated: result.truncated,
        transcript: result.transcript,
        speakers: result.speakers
      });
    } catch (persistError) {
      console.error("No se pudo guardar la transcripcion en la base:", persistError);
    }

    return NextResponse.json({
      transcript: result.transcript,
      speakers: result.speakers,
      durationSec: result.durationSec,
      costUsd: Number(result.costUsd.toFixed(4)),
      truncated: result.truncated,
      identifiedCount: identificados,
      unidentifiedCount: result.speakers.length - identificados,
      meetingId,
      saved: Boolean(meetingId)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    // yt-dlp y ffmpeg son binarios del sistema, no dependencias de npm: si el deploy
    // no los tiene, el error real es este y conviene decirlo en vez de un 500 mudo.
    if (/No se pudo ejecutar (yt-dlp|ffmpeg|ffprobe)/.test(message)) {
      return NextResponse.json(
        { error: "Faltan yt-dlp o ffmpeg en el servidor. Sin eso no se puede procesar el video." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
