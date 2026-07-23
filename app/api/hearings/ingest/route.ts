import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type HearingSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { matchFullTranscript } from "@/lib/hearings/batch-match";
import { runIngestJob } from "@/lib/hearings/ingest-job";
import { parseTranscriptFile } from "@/lib/hearings/transcript";

export const dynamic = "force-dynamic";

const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|live\/|shorts\/)[\w-]{6,}|youtu\.be\/[\w-]{6,})/;

const jsonSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("transcript"),
    title: z.string().trim().min(1).max(200),
    occurredAt: z.string().datetime().nullish(),
    reformId: z.string().trim().min(1).max(60),
    description: z.string().trim().max(8000).nullish(),
    fileName: z.string().trim().min(1).max(200),
    content: z.string().trim().min(20).max(2_000_000)
  }),
  z.object({
    mode: z.literal("youtube"),
    title: z.string().trim().min(1).max(200),
    occurredAt: z.string().datetime().nullish(),
    reformId: z.string().trim().min(1).max(60),
    description: z.string().trim().max(8000).nullish(),
    url: z.string().trim().regex(YOUTUBE_URL_PATTERN, "URL de YouTube inválida")
  })
]);

type SessionInfo = { userId: string };

async function createHearing(input: {
  title: string;
  occurredAt: string | null | undefined;
  reformId: string;
  description: string | null | undefined;
  hearingSource: HearingSource;
  ingest: Prisma.InputJsonValue | null;
  session: SessionInfo;
}) {
  const reform = await prisma.normativeReform.findUnique({ where: { id: input.reformId }, select: { id: true } });
  if (!reform) return null;

  return prisma.meeting.create({
    data: {
      title: input.title,
      kind: "PUBLIC_HEARING",
      status: "PENDING",
      hearingStatus: "PROCESSING",
      hearingSource: input.hearingSource,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
      reformId: input.reformId,
      description: input.description ?? null,
      metadata: { requestedBy: input.session.userId, ...(input.ingest ? { ingest: input.ingest } : {}) },
      // El expediente nace con la audiencia (igual que en createHearing de
      // lib/hearings/data.ts): sin el, el espejo de lifecycle seria un no-op.
      hearingRecord: {
        create: { lifecycle: "EN_CURSO", mainTopic: "", recordNumber: "", recordTitle: input.title }
      }
    },
    select: { id: true }
  });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "La carga de audiencias requiere conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede cargar audiencias." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    // --- Audio/video subido: multipart. Se procesa en background. ---
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const title = String(form.get("title") ?? "").trim();
      const reformId = String(form.get("reformId") ?? "").trim();
      const occurredAt = form.get("occurredAt") ? String(form.get("occurredAt")) : null;
      const description = form.get("description") ? String(form.get("description")) : null;
      const file = form.get("file");

      if (!title || !reformId || !(file instanceof File)) {
        return NextResponse.json({ error: "Datos inválidos", detail: "Faltan el título, el código nuevo o el archivo." }, { status: 400 });
      }

      const workDir = mkdtempSync(path.join(tmpdir(), "urbania-upload-"));
      const filePath = path.join(workDir, file.name.replace(/[^\w.-]/g, "_") || "audio.bin");
      writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

      const meeting = await createHearing({
        title,
        occurredAt: occurredAt || null,
        reformId,
        description,
        hearingSource: "UPLOAD",
        ingest: { mode: "upload", filePath },
        session
      });
      if (!meeting) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

      void runIngestJob(meeting.id).catch((error) => console.error("Ingesta de audio falló", error));
      return NextResponse.json({ meetingId: meeting.id, status: "processing" }, { status: 201 });
    }

    // --- Transcripcion subida (sincrono) o YouTube (background): JSON. ---
    const parsed = jsonSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", detail: "Revisá los datos y la fuente de la audiencia." }, { status: 400 });
    }

    if (parsed.data.mode === "transcript") {
      const chunks = parseTranscriptFile(parsed.data.fileName, parsed.data.content);
      if (!chunks.length) {
        return NextResponse.json({ error: "Transcripción vacía", detail: "El archivo no tiene texto reconocible." }, { status: 400 });
      }

      const meeting = await createHearing({
        title: parsed.data.title,
        occurredAt: parsed.data.occurredAt,
        reformId: parsed.data.reformId,
        description: parsed.data.description,
        hearingSource: "UPLOAD",
        ingest: null,
        session
      });
      if (!meeting) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

      // Camino confiable: sin binarios, sincronico. Machea y finaliza en la request.
      const result = await matchFullTranscript({ meetingId: meeting.id, reformId: parsed.data.reformId, chunks });
      return NextResponse.json({ meetingId: meeting.id, status: "completed", result }, { status: 201 });
    }

    // YouTube: background.
    const meeting = await createHearing({
      title: parsed.data.title,
      occurredAt: parsed.data.occurredAt,
      reformId: parsed.data.reformId,
      description: parsed.data.description,
      hearingSource: "YOUTUBE",
      ingest: { mode: "youtube", url: parsed.data.url },
      session
    });
    if (!meeting) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    void runIngestJob(meeting.id).catch((error) => console.error("Ingesta de YouTube falló", error));
    return NextResponse.json({ meetingId: meeting.id, status: "processing" }, { status: 201 });
  } catch (error) {
    console.error("No se pudo cargar la audiencia", error);
    return NextResponse.json({ error: "No se pudo cargar la audiencia", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}
