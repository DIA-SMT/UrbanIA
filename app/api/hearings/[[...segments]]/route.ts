import { HearingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canViewInternal, getSessionUser, hasPermission } from "@/lib/auth/api";
import { readModuleId, type SegmentsArg } from "@/lib/api/segments";
import { prisma } from "@/lib/db/prisma";
import { handleAnalyze } from "@/lib/hearings/api/analyze";
import { handleAnalyzeRecording } from "@/lib/hearings/api/analyze-recording";
import { handleAudioPart, handleAudioPartUrl } from "@/lib/hearings/api/audio";
import { handleCompleteFicha } from "@/lib/hearings/api/complete-ficha";
import { handleConclusions } from "@/lib/hearings/api/conclusions";
import { handleDocumentDelete } from "@/lib/hearings/api/document-delete";
import { handleDocumentSign, handleDocumentUpload } from "@/lib/hearings/api/documents";
import { handleDraft } from "@/lib/hearings/api/draft";
import { handleFicha } from "@/lib/hearings/api/ficha";
import { handleFinalize } from "@/lib/hearings/api/finalize";
import { handleGenerateAnalysis } from "@/lib/hearings/api/generate-analysis";
import { handleIngest } from "@/lib/hearings/api/ingest";
import { handleRetryIngest } from "@/lib/hearings/api/retry-ingest";
import { handlePublishSummary, handleSummaryPdf, handleUnpublishSummary } from "@/lib/hearings/api/summary";
import { handleTranscribePart } from "@/lib/hearings/api/transcribe-part";
import { createHearing, getHearing, getHearingCounts, listHearings, updateHearing, type HearingFilters } from "@/lib/hearings/data";
import { removeHearingAudioFolder, removeHearingDocument } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** El paso mas lento es el resumen ejecutivo (modelo fuerte redactando ~9k
 *  tokens, 90-150 s). Con Fluid Compute el techo de Hobby es 300 s. */
export const maxDuration = 300;

/*
 * TODO el modulo de audiencias entra por esta ruta: el registro, la creacion, la
 * ingesta de una audiencia ya ocurrida y todas las operaciones sobre UNA
 * audiencia, con la operacion en el query param `action`.
 *
 * El motivo es una restriccion de la plataforma: en el plan Hobby de Vercel un
 * deploy admite 12 funciones serverless y cada route.ts cuenta como una. Este
 * modulo tenia 14 rutas el solo; despues quedo en tres (coleccion, /<id> y
 * /audio) y ahora en dos.
 *
 * El archivo es un catch-all OPCIONAL, asi que la misma funcion atiende
 * /api/hearings (sin segmentos, la coleccion) y /api/hearings/<id> (con el id en
 * el primer segmento). Ningun cliente cambio.
 *
 * Se hizo con catch-all y no con un rewrite a `?id=`: un rewrite llega a la
 * funcion pero Next NO propaga el query que inyecta el destination, asi que
 * TODAS las llamadas /api/hearings/<id> caian en la rama de la coleccion y
 * respondian "Sesion requerida" (verificado en dev antes de commitear). Con
 * params el id llega por el mecanismo nativo, sin depender de eso.
 *
 * La descarga del audio completo sigue en /api/hearings/audio, con funcion
 * PROPIA: es la unica que necesita el binario de ffmpeg (~80 MB) y esta funcion
 * ya carga onnx y Chromium. Una ruta estatica le gana al catch-all en la
 * precedencia de Next, asi que /api/hearings/audio nunca entra por aca.
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
  // Grabacion en vivo: firmar la subida de un tramo y registrarlo ya subido.
  "audio-part-url": handleAudioPartUrl,
  "audio-part": handleAudioPart,
  // Analisis de la grabacion: un tramo por llamada (el navegador maneja el
  // recorrido) y despues el cierre con cruces, resumen e indexado.
  "transcribe-part": handleTranscribePart,
  "analyze-recording": handleAnalyzeRecording,
  "complete-ficha": handleCompleteFicha,
  conclusions: handleConclusions,
  documents: handleDocumentUpload,
  "sign-document": handleDocumentSign,
  draft: handleDraft,
  finalize: handleFinalize,
  "generate-analysis": handleGenerateAnalysis,
  "retry-ingest": handleRetryIngest,
  // Resumen ejecutivo para la ciudadania: se genera, se revisa y se publica.
  "publicar-resumen": handlePublishSummary,
  "despublicar-resumen": handleUnpublishSummary
} as const;

type PostAction = keyof typeof POST_ACTIONS;

function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function GET(request: Request, { params }: SegmentsArg) {
  const id = await readModuleId(params);
  if (id instanceof NextResponse) return id;

  if (id) {
    // `?action=resumen` genera el resumen ejecutivo imprimible (staff).
    if (accion(request) === "resumen") {
      return handleSummaryPdf(request, id);
    }

    // El detalle no tenia ningun chequeo de sesion: devolvia la audiencia
    // completa a cualquiera que supiera el id, y /api/hearings no esta en el
    // matcher del middleware, asi que tampoco lo cubria esa barrera. Lo consume
    // el polling de la ingesta, que ya corre autenticado.
    const sessionDetalle = await getSessionUser();
    if (!sessionDetalle || !canViewInternal(sessionDetalle)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
    }
    const hearing = await getHearing(id).catch(() => null);
    if (!hearing) {
      return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ hearing });
  }

  // Registro interno de audiencias. El vecino lee el registro publico en
  // /audiencias-publicas, que sale de lib/hearings/public-data.
  const session = await getSessionUser();
  if (!session || !canViewInternal(session)) {
    return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ hearings: [], counts: { upcoming: 0, processing: 0, completed: 0 }, isLive: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && (Object.values(HearingStatus) as string[]).includes(statusParam) ? (statusParam as HearingStatus) : undefined;
    const reformId = searchParams.get("reformId") ?? undefined;

    const filters: HearingFilters = { status, reformId };
    const [hearings, counts] = await Promise.all([listHearings(filters), getHearingCounts()]);
    return NextResponse.json({ hearings, counts, isLive: true });
  } catch (error) {
    console.error("No se pudieron listar las audiencias", error);
    return NextResponse.json({ hearings: [], counts: { upcoming: 0, processing: 0, completed: 0 }, isLive: false });
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  occurredAt: z.string().datetime().nullish(),
  modality: z.string().trim().max(80).nullish(),
  location: z.string().trim().max(200).nullish(),
  reformId: z.string().trim().min(1).max(60).nullish(),
  topic: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(8000).nullish()
});

/**
 * Con `?id=`, una operacion sobre ESA audiencia (ver POST_ACTIONS). Sin id,
 * registrar una audiencia nueva o cargar una ya ocurrida (`?action=ingest`).
 */
export async function POST(request: Request, { params }: SegmentsArg) {
  const id = await readModuleId(params);
  if (id instanceof NextResponse) return id;
  if (id) {
    const action = accion(request);
    // hasOwn y no un `in` ni el lookup pelado: `action` lo elige el cliente, y
    // las claves que POST_ACTIONS hereda de Object.prototype ("constructor",
    // "toString", "valueOf") resolvian a algo truthy. Se colaban por el chequeo
    // de abajo y se llamaban como si fueran handlers, asi que un anonimo sacaba
    // un 500 de la funcion mas cargada del proyecto con solo pedir
    // ?action=constructor.
    if (!Object.hasOwn(POST_ACTIONS, action)) {
      return NextResponse.json(
        { error: "Acción inválida", detail: `"${action}" no es una operación de audiencia.` },
        { status: 400 }
      );
    }
    return POST_ACTIONS[action as PostAction](request, id);
  }

  if (accion(request) === "ingest") {
    return handleIngest(request);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "El registro de audiencias requiere conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para registrar una audiencia." }, { status: 401 });
  if (!hasPermission(session, "hearings.create")) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede registrar audiencias." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Revisá el título y los datos de la audiencia." }, { status: 400 });
  }

  // Se necesita un tema: un código nuevo (con cruce) o un tema libre (sin cruce).
  if (!parsed.data.reformId && !parsed.data.topic) {
    return NextResponse.json({ error: "Falta el tema", detail: "Elegí un código nuevo o escribí un tema a tratar." }, { status: 400 });
  }

  try {
    const hearing = await createHearing({
      title: parsed.data.title,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
      modality: parsed.data.modality ?? null,
      location: parsed.data.location ?? null,
      reformId: parsed.data.reformId ?? null,
      topic: parsed.data.reformId ? null : (parsed.data.topic ?? null),
      description: parsed.data.description ?? null
    });
    return NextResponse.json({ hearing }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear la audiencia", error);
    return NextResponse.json({ error: "No se pudo crear la audiencia", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
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

export async function PATCH(request: Request, { params }: SegmentsArg) {
  const id = await readModuleId(params);
  if (id instanceof NextResponse) return id;
  if (!id) return NextResponse.json({ error: "Falta la audiencia" }, { status: 400 });

  // `?action=ficha` edita la Ficha 1 del expediente; sin action, los datos
  // generales de la audiencia.
  if (accion(request) === "ficha") {
    return handleFicha(request, id);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "hearings.edit")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

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

export async function DELETE(request: Request, { params }: SegmentsArg) {
  const id = await readModuleId(params);
  if (id instanceof NextResponse) return id;
  if (!id) return NextResponse.json({ error: "Falta la audiencia" }, { status: 400 });

  // Con `?docId=` se borra UN documento adjunto (permiso de staff); sin el, la
  // audiencia entera, que exige ADMIN.
  const docId = new URL(request.url).searchParams.get("docId");
  if (docId) return handleDocumentDelete(id, docId);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "hearings.delete")) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar audiencias." }, { status: 403 });
  }

  try {
    // Borrar una audiencia se lleva tambien su GRABACION, y de eso no hay copia
    // en ningun otro lado (salvo que se haya corrido hearings:backup-audio).
    // Antes de perder horas de registro publico, se pide una confirmacion
    // explicita que diga cuanto audio se va a borrar.
    const audio = await prisma.meetingMedia.aggregate({
      where: { meetingId: id, kind: "AUDIO" },
      _count: { _all: true },
      _sum: { durationSec: true }
    });
    if (audio._count._all > 0 && new URL(request.url).searchParams.get("confirmAudio") !== "1") {
      const minutos = Math.max(1, Math.round((audio._sum.durationSec ?? 0) / 60));
      return NextResponse.json(
        {
          error: "La audiencia tiene grabación",
          detail: `Se van a borrar ${audio._count._all} ${audio._count._all === 1 ? "tramo" : "tramos"} de audio (unos ${minutos} minutos de grabación) y no se pueden recuperar.`,
          audioParts: audio._count._all,
          audioMinutes: minutos
        },
        { status: 409 }
      );
    }

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

    // El audio de la grabacion en vivo tampoco cae por cascade. Se borra la
    // carpeta entera del bucket en vez de recorrer las filas de MeetingMedia:
    // si alguna subida quedo sin registrar, igual se limpia.
    await removeHearingAudioFolder(id).catch((error) => console.error("No se pudo borrar el audio del bucket", error));

    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la audiencia", error);
    return NextResponse.json({ error: "No se pudo eliminar la audiencia" }, { status: 500 });
  }
}
