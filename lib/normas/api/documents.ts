import { NextResponse } from "next/server";
import { z } from "zod";
import { MunicipalArea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { hasOpenRouterConfig } from "@/lib/ai/openrouter";
import { analyzeReformDocument, UnreadablePdfError, UnusableAnalysisError } from "@/lib/normas/analyze-document";
import { createNorm } from "@/lib/projects/data";
import {
  createNormDocumentUploadUrl,
  downloadNormDocument,
  getNormDocumentPublicUrl,
  hasNormsStorage
} from "@/lib/storage/supabase";

/**
 * Cubre el paso mas lento de los tres (analizar un PDF con el modelo). 60 s es
 * ademas el techo del plan Hobby de Vercel.
 */

/**
 * Las tres acciones del importador viven en ESTA ruta, discriminadas por
 * `action`, en vez de una ruta por operacion.
 *
 * El motivo es una restriccion de la plataforma, no de diseño: en el plan Hobby
 * de Vercel un deploy admite 12 funciones serverless y cada route.ts cuenta
 * como una. Son tres pasos del MISMO flujo (pedir URL -> analizar -> confirmar)
 * sobre el mismo recurso, asi que agruparlas es defendible; cada una sigue
 * siendo su propia funcion abajo.
 */
const ACTIONS = ["upload-url", "analyze", "confirm"] as const;

/** Limite acordado para los PDFs aportados a la reforma. */
const MAX_FILE_BYTES = 30 * 1024 * 1024;

const uploadUrlSchema = z.object({
  action: z.literal("upload-url"),
  fileName: z.string().trim().min(1).max(240),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().trim().max(160)
});

const analyzeSchema = z.object({
  action: z.literal("analyze"),
  storagePath: z.string().trim().min(1).max(400)
});

const acceptedProposalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(8000),
  areas: z.array(z.nativeEnum(MunicipalArea)).max(9).default([]),
  sourcePages: z.array(z.number().int().positive()).max(40).default([]),
  evidenceQuote: z.string().trim().max(1200).default("")
});

const confirmSchema = z.object({
  // Opcional por compatibilidad: el cliente viejo posteaba sin `action`, y este
  // era el unico POST de la ruta.
  action: z.literal("confirm").optional(),
  storagePath: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(240),
  sizeBytes: z.number().int().nonnegative().nullish(),
  pageCount: z.number().int().nonnegative().nullish(),
  documentKind: z.string().trim().max(60).nullish(),
  documentSummary: z.string().trim().max(4000).nullish(),
  organization: z.string().trim().max(200).nullish(),
  sha256: z.string().trim().max(80).nullish(),
  model: z.string().trim().max(120).nullish(),
  acceptedProposals: z.array(acceptedProposalSchema).max(20).default([])
});

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** El storagePath lo genera el server al firmar y siempre arranca con el id de
 *  la reforma: se verifica para que no se pueda leer el PDF de otra pasando una
 *  ruta a mano. */
function pathBelongsToReform(storagePath: string, reformId: string): boolean {
  return storagePath.startsWith(`${reformId}/`);
}

/**
 * Nota de trazabilidad de cada norma importada.
 *
 * Carga el peso de distinguir tres roles que es facil confundir:
 *   - quien APORTO el material (la organizacion que mando el PDF),
 *   - quien REVISO y confirmo la ficha (la persona del equipo, que ademas
 *     queda como authorName porque es quien puede editarla),
 *   - quien REDACTO el articulado (nadie todavia: eso lo genera Formalizar).
 *
 * La ultima linea importa especialmente: la agrupacion mando una presentacion,
 * no un articulo. Que el expediente no le atribuya un texto que no escribio.
 */
function buildOfficialNotes(input: {
  fileName: string;
  pages: number[];
  organization: string | null;
  model: string | null;
  userName: string;
}): string {
  const paginas = input.pages.length ? `, páginas ${input.pages.join(", ")}` : "";
  const aportadoPor = input.organization ? ` Aportado por ${input.organization}` : " Aportado";
  const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return [
    `Origen: ${input.fileName}${paginas}.${aportadoPor} en el marco de la 1ª Audiencia Pública.`,
    `Ficha propuesta por IA (${input.model ?? "modelo no registrado"}) y revisada por ${input.userName} el ${fecha}.`,
    input.organization
      ? `La norma figura a nombre de ${input.userName} porque es quien la revisó y la edita; la propuesta es de ${input.organization}.`
      : "",
    "El articulado NO fue redactado por la organización: se genera en el paso Formalizar y debe validarse."
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Confirma el analisis: guarda el documento como antecedente de la reforma y
 * crea las normas que la persona acepto.
 *
 * `acceptedProposals: []` es un camino de EXITO, no un error: el documento se
 * guarda igual. La mayoria de los PDFs de la audiencia son encuadres
 * institucionales o ponencias, y su valor es quedar registrados.
 */
export async function handleDocumentsPost(request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "documents.upload")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = (body && typeof body === "object" && "action" in body ? body.action : "confirm") ?? "confirm";

  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  if (action === "upload-url") return handleUploadUrl(body, id);
  if (action === "analyze") return handleAnalyze(body, id);
  return handleConfirm(body, id, session.userId);
}

/** Paso 1: firma la subida. El archivo va DIRECTO del browser al bucket. */
async function handleUploadUrl(body: unknown, reformId: string) {
  if (!hasNormsStorage()) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado", detail: "Falta configurar Supabase Storage para guardar los PDF." },
      { status: 503 }
    );
  }
  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Faltan el nombre, el peso o el tipo del archivo." }, { status: 400 });
  }
  const { fileName, sizeBytes } = parsed.data;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Formato no soportado", detail: `"${fileName}" no es un PDF. El importador solo lee PDF.` },
      { status: 415 }
    );
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Archivo demasiado pesado", detail: `"${fileName}" pesa ${formatSize(sizeBytes)} y el límite es 30 MB.` },
      { status: 413 }
    );
  }

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id: reformId }, select: { id: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    return NextResponse.json(await createNormDocumentUploadUrl({ reformId, fileName }));
  } catch (error) {
    console.error("No se pudo firmar la subida del documento", error);
    return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500 });
  }
}

/** Paso 2: lee el PDF y le pide al modelo las propuestas. NO persiste nada. */
async function handleAnalyze(body: unknown, reformId: string) {
  if (!hasNormsStorage()) {
    return NextResponse.json({ error: "Almacenamiento no configurado" }, { status: 503 });
  }
  if (!hasOpenRouterConfig()) {
    return NextResponse.json(
      { error: "IA no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
      { status: 503 }
    );
  }
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Falta la ruta del archivo subido." }, { status: 400 });
  }
  if (!pathBelongsToReform(parsed.data.storagePath, reformId)) {
    return NextResponse.json({ error: "Ruta inválida", detail: "El archivo no pertenece a este código nuevo." }, { status: 400 });
  }

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id: reformId }, select: { title: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    const bytes = await downloadNormDocument(parsed.data.storagePath);
    return NextResponse.json(await analyzeReformDocument({ bytes, reformTitle: reform.title }));
  } catch (error) {
    // El PDF sin texto NO es un fallo del sistema: el archivo ya esta subido y
    // se puede guardar igual como antecedente.
    if (error instanceof UnreadablePdfError) {
      return NextResponse.json({ error: "PDF sin texto legible", detail: error.message }, { status: 422 });
    }
    if (error instanceof UnusableAnalysisError) {
      return NextResponse.json({ error: "Respuesta inesperada", detail: error.message }, { status: 502 });
    }
    console.error("No se pudo analizar el documento de la reforma", error);
    return NextResponse.json(
      { error: "No se pudo analizar el documento", detail: error instanceof Error ? error.message : undefined },
      { status: 502 }
    );
  }
}

/** Paso 3: guarda el antecedente y crea las normas aceptadas. */
async function handleConfirm(body: unknown, id: string, userId: string) {
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Revisá los datos del documento." }, { status: 400 });
  }
  if (!pathBelongsToReform(parsed.data.storagePath, id)) {
    return NextResponse.json({ error: "Ruta inválida", detail: "El archivo no pertenece a este código nuevo." }, { status: 400 });
  }

  const data = parsed.data;
  const session = { userId };

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id }, select: { id: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    // Para el texto de la nota alcanza un generico; para authorName NO, porque
    // ese campo gobierna quien puede editar: un nombre que nadie va a tipear
    // como identidad activa deja la norma trabada. Sin nombre real va null,
    // que el editor interpreta como "sin dueño" y deja editar a cualquiera.
    const userName = user?.name ?? "el equipo";
    const ownerName = user?.name?.trim() || null;
    const url = hasNormsStorage() ? getNormDocumentPublicUrl(data.storagePath) : null;

    const document = await prisma.reformDocument.create({
      data: {
        reformId: id,
        name: data.fileName,
        type: "application/pdf",
        url,
        storagePath: data.storagePath,
        sizeBytes: data.sizeBytes ?? null,
        pageCount: data.pageCount ?? null,
        summary: data.documentSummary ?? null,
        documentKind: data.documentKind ?? null,
        sha256: data.sha256 ?? null,
        uploadedBy: session.userId
      }
    });

    // Una norma por propuesta aceptada. El PDF NO se duplica: cada
    // ProjectAttachment apunta al mismo storagePath que el antecedente.
    const norms = [];
    for (const proposal of data.acceptedProposals) {
      const norm = await createNorm({
        reformId: id,
        title: proposal.title,
        summary: proposal.summary,
        areas: proposal.areas,
        status: "DRAFT",
        // La propuesta la trajo una agrupacion, no el equipo tecnico.
        source: "CITIZEN",
        // authorName es QUIEN REDACTA, y ademas gobierna los permisos de
        // edicion: el editor solo deja editar si la identidad activa coincide
        // con este nombre. Va la persona que reviso y confirmo la ficha, no la
        // organizacion del PDF —poner ahi "Colegio de Arquitectos" dejaba la
        // norma imposible de editar para cualquiera—. De donde salio el aporte
        // queda asentado en officialNotes, que es su lugar.
        authorName: ownerName,
        createdById: session.userId,
        officialNotes: buildOfficialNotes({
          fileName: data.fileName,
          pages: proposal.sourcePages,
          organization: data.organization ?? null,
          model: data.model ?? null,
          userName
        })
      });

      await prisma.projectAttachment.create({
        data: {
          projectId: norm.id,
          kind: "PDF_ORIGEN",
          name: data.fileName,
          excerpt: proposal.evidenceQuote || null,
          storagePath: data.storagePath,
          url,
          mimeType: "application/pdf",
          sizeBytes: data.sizeBytes ?? null,
          sourcePages: proposal.sourcePages,
          uploadedBy: session.userId
        }
      });

      norms.push({ id: norm.id, code: norm.code, title: norm.title });
    }

    return NextResponse.json({ document, norms }, { status: 201 });
  } catch (error) {
    console.error("No se pudo guardar el documento de la reforma", error);
    return NextResponse.json({ error: "No se pudo guardar el documento" }, { status: 500 });
  }
}

/** Antecedentes ya cargados de la reforma, con cuántas normas salieron de cada uno. */
export async function handleDocumentsList(_request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ documents: [] });
  }

  const documents = await prisma.reformDocument.findMany({
    where: { reformId: id },
    orderBy: { uploadedAt: "desc" },
    take: 200
  });

  // Cuantas normas salieron de cada PDF, por storagePath (los adjuntos apuntan
  // al mismo objeto que el antecedente).
  const paths = documents.map((document) => document.storagePath).filter((path): path is string => Boolean(path));
  const attachments = paths.length
    ? await prisma.projectAttachment.groupBy({
        by: ["storagePath"],
        where: { storagePath: { in: paths } },
        _count: { _all: true }
      })
    : [];
  const normCountByPath = new Map(attachments.map((row) => [row.storagePath, row._count._all]));

  return NextResponse.json({
    documents: documents.map((document) => ({
      ...document,
      normCount: document.storagePath ? (normCountByPath.get(document.storagePath) ?? 0) : 0
    }))
  });
}
