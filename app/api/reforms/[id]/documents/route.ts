import { NextResponse } from "next/server";
import { z } from "zod";
import { MunicipalArea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createNorm } from "@/lib/projects/data";
import { getNormDocumentPublicUrl, hasNormsStorage } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
/** Crear N normas es N transacciones: no entra en el default de 10 s. */
export const maxDuration = 60;

const acceptedProposalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(8000),
  areas: z.array(z.nativeEnum(MunicipalArea)).max(9).default([]),
  sourcePages: z.array(z.number().int().positive()).max(40).default([]),
  evidenceQuote: z.string().trim().max(1200).default("")
});

const bodySchema = z.object({
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

/**
 * Nota de trazabilidad de cada norma importada.
 *
 * La ultima linea importa: la agrupacion mando una presentacion, no un
 * articulo redactado. Que el expediente no le atribuya un texto que no
 * escribio.
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
    "El articulado NO fue redactado por la organización: se genera en el paso Formalizar y debe validarse."
  ].join("\n");
}

/**
 * Confirma el analisis: guarda el documento como antecedente de la reforma y
 * crea las normas que la persona acepto.
 *
 * `acceptedProposals: []` es un camino de EXITO, no un error: el documento se
 * guarda igual. La mayoria de los PDFs de la audiencia son encuadres
 * institucionales o ponencias, y su valor es quedar registrados.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Revisá los datos del documento." }, { status: 400 });
  }
  if (!parsed.data.storagePath.startsWith(`${id}/`)) {
    return NextResponse.json({ error: "Ruta inválida", detail: "El archivo no pertenece a este código nuevo." }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id }, select: { id: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    const userName = user?.name ?? "el equipo";
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
        authorName: data.organization ?? null,
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
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ documents: [] });
  }
  const { id } = await params;

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
