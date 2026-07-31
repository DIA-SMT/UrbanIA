import { HearingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { handleAnalyze } from "@/lib/hearings/api/analyze";
import { handleCompleteFicha } from "@/lib/hearings/api/complete-ficha";
import { handleConclusions } from "@/lib/hearings/api/conclusions";
import { handleDocumentDelete } from "@/lib/hearings/api/document-delete";
import { handleDocumentSign, handleDocumentUpload } from "@/lib/hearings/api/documents";
import { handleDraft } from "@/lib/hearings/api/draft";
import { handleFicha } from "@/lib/hearings/api/ficha";
import { handleFinalize } from "@/lib/hearings/api/finalize";
import { handleGenerateAnalysis } from "@/lib/hearings/api/generate-analysis";
import { handleLiveMatch } from "@/lib/hearings/api/live-match";
import { handleRetryIngest } from "@/lib/hearings/api/retry-ingest";
import { getHearing, updateHearing } from "@/lib/hearings/data";
import { removeHearingDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** El paso mas lento es generar el analisis; 60 s es el techo del plan Hobby. */
export const maxDuration = 60;

/*
 * Todas las operaciones sobre UNA audiencia entran por esta ruta, con la
 * operacion en el query param `action`.
 *
 * El motivo es una restriccion de la plataforma: en el plan Hobby de Vercel un
 * deploy admite 12 funciones serverless y cada route.ts cuenta como una. Este
 * modulo tenia 14 rutas el solo.
 *
 * La accion va en la QUERY y no en el cuerpo a proposito: subir un documento
 * manda multipart y borrar no manda cuerpo, asi que leer el body para decidir
 * no funcionaria de forma uniforme (y ademas lo dejaria consumido).
 *
 * Cada handler vive en lib/hearings/api/ con su codigo intacto: esto es una
 * centralita, no una refundicion de la logica.
 */
const POST_ACTIONS = {
  analyze: handleAnalyze,
  "complete-ficha": handleCompleteFicha,
  conclusions: handleConclusions,
  documents: handleDocumentUpload,
  "sign-document": handleDocumentSign,
  draft: handleDraft,
  finalize: handleFinalize,
  "generate-analysis": handleGenerateAnalysis,
  "live-match": handleLiveMatch,
  "retry-ingest": handleRetryIngest
} as const;

type PostAction = keyof typeof POST_ACTIONS;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = new URL(request.url).searchParams.get("action") ?? "";
  const handler = POST_ACTIONS[action as PostAction];
  if (!handler) {
    return NextResponse.json(
      { error: "Acción inválida", detail: `"${action}" no es una operación de audiencia.` },
      { status: 400 }
    );
  }
  return handler(request, id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const { id } = await params;
  const hearing = await getHearing(id).catch(() => null);
  if (!hearing) {
    return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ hearing });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  occurredAt: z.string().datetime().nullish(),
  modality: z.string().trim().max(80).nullish(),
  location: z.string().trim().max(200).nullish(),
  reformId: z.string().trim().min(1).max(60).nullish(),
  description: z.string().trim().max(8000).nullish(),
  hearingStatus: z.nativeEnum(HearingStatus).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // `?action=ficha` edita la Ficha 1 del expediente; sin action, los datos
  // generales de la audiencia.
  if (new URL(request.url).searchParams.get("action") === "ficha") {
    return handleFicha(request, id);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const hearing = await updateHearing(id, {
      ...parsed.data,
      occurredAt: parsed.data.occurredAt === undefined ? undefined : parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null
    });
    if (!hearing) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
    return NextResponse.json({ hearing });
  } catch (error) {
    console.error("No se pudo actualizar la audiencia", error);
    return NextResponse.json({ error: "No se pudo actualizar la audiencia" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Con `?docId=` se borra UN documento adjunto (permiso de staff); sin el, la
  // audiencia entera, que exige ADMIN.
  const docId = new URL(request.url).searchParams.get("docId");
  if (docId) return handleDocumentDelete(id, docId);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar audiencias." }, { status: 403 });
  }

  try {
    // Los HearingDocument caen por cascade, pero los archivos del bucket no:
    // se borran a mano (best-effort) antes de eliminar la reunion.
    const documents = await prisma.hearingDocument.findMany({
      where: { hearingRecord: { meetingId: id }, storagePath: { not: null } },
      select: { storagePath: true }
    });
    for (const document of documents) {
      if (document.storagePath) {
        await removeHearingDocument(document.storagePath).catch((error) => console.error("No se pudo borrar el objeto del bucket", error));
      }
    }

    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la audiencia", error);
    return NextResponse.json({ error: "No se pudo eliminar la audiencia" }, { status: 500 });
  }
}
