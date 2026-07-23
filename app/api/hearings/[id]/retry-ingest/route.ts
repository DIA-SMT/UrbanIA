import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { isIngestStalled, readIngestSpec, runIngestJob } from "@/lib/hearings/ingest-job";

export const dynamic = "force-dynamic";

/**
 * Reintenta la ingesta batch de una audiencia que fallo o quedo trabada
 * (PROCESSING sin latido: el job murio con el proceso, p. ej. al reiniciarse el
 * dev server). Limpia el error y vuelve a disparar el job con la misma fuente
 * guardada en metadata.ingest.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;

  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id, kind: "PUBLIC_HEARING" },
      select: { status: true, hearingStatus: true, metadata: true, updatedAt: true }
    });
    if (!meeting) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

    const spec = readIngestSpec(meeting.metadata);
    if (!spec) {
      return NextResponse.json(
        { error: "Sin fuente de ingesta", detail: "Esta audiencia no tiene un video ni un archivo pendiente de procesar." },
        { status: 422 }
      );
    }

    const metadata =
      meeting.metadata && typeof meeting.metadata === "object" && !Array.isArray(meeting.metadata)
        ? (meeting.metadata as Prisma.JsonObject)
        : {};
    const hasError = typeof metadata.error === "string" && metadata.error.trim().length > 0;
    const running = meeting.status === "PROCESSING" && !hasError && !isIngestStalled(meeting.metadata, meeting.updatedAt);
    if (running) {
      return NextResponse.json(
        { error: "Todavía en curso", detail: "El procesamiento sigue corriendo. Esperá unos minutos antes de reintentar." },
        { status: 409 }
      );
    }
    if (meeting.hearingStatus === "COMPLETED") {
      return NextResponse.json({ error: "Ya finalizada", detail: "Esta audiencia ya se procesó por completo." }, { status: 409 });
    }

    await prisma.meeting.update({
      where: { id },
      data: {
        status: "PENDING",
        hearingStatus: "PROCESSING",
        metadata: { ...metadata, error: null, ingestHeartbeatAt: new Date().toISOString() }
      }
    });

    void runIngestJob(id).catch((error) => console.error("Reintento de ingesta falló", error));
    return NextResponse.json({ ok: true, status: "processing" });
  } catch (error) {
    console.error("No se pudo reintentar la ingesta", error);
    return NextResponse.json({ error: "No se pudo reintentar la ingesta" }, { status: 500 });
  }
}
