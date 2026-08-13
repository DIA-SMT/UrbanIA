import { ReformStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canViewInternal, getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { handleDocumentDelete } from "@/lib/normas/api/document-delete";
import { handleDocumentsList, handleDocumentsPost } from "@/lib/normas/api/documents";
import { handleReformExport } from "@/lib/normas/api/reform-export";
import { createReform, getReform, listReforms, updateReform } from "@/lib/projects/data";

export const dynamic = "force-dynamic";
/** Analizar un PDF llama al modelo: no entra en el default de 10 s. */
export const maxDuration = 60;

/*
 * Codigos nuevos: el listado, la creacion y todo lo que cuelga de UNO entran por
 * esta unica ruta. El plan Hobby de Vercel admite 12 funciones serverless por
 * deploy y cada route.ts cuenta una.
 *
 * El archivo es un catch-all OPCIONAL: la misma funcion atiende /api/reforms
 * (sin segmentos, la coleccion) y /api/reforms/<id> (con el id en el primer
 * segmento). Ningun cliente cambio.
 *
 * Se hizo con catch-all y no con un rewrite a `?id=`: un rewrite llega a la
 * funcion pero Next NO propaga el query que inyecta el destination, asi que
 * todas las llamadas /api/reforms/<id> caian en la rama de la coleccion
 * (verificado en dev antes de commitear).
 *
 * Cada handler vive en lib/normas/api/ con su codigo intacto.
 */
/** Segmentos de la URL. Vacio en la coleccion, `[id]` en un codigo nuevo. */
type Segments = { params: Promise<{ segments?: string[] }> };

function accion(request: Request): string {
  return new URL(request.url).searchParams.get("action") ?? "";
}

export async function GET(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;

  if (id) {
    if (accion(request) === "export") return handleReformExport(request, id);
    if (accion(request) === "documents") return handleDocumentsList(request, id);

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
    }
    const reform = await getReform(id).catch(() => null);
    if (!reform) {
      return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ reform });
  }

  // Reformas normativas en construccion: trabajo interno, no publicado.
  const session = await getSessionUser();
  if (!session || !canViewInternal(session)) {
    return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ reforms: [], isLive: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && (Object.values(ReformStatus) as string[]).includes(statusParam) ? (statusParam as ReformStatus) : undefined;
    const reforms = await listReforms({ status });
    return NextResponse.json({ reforms, isLive: true });
  } catch (error) {
    console.error("No se pudieron listar los codigos nuevos", error);
    return NextResponse.json({ reforms: [], isLive: false });
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish()
});

export async function POST(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (id) {
    // El paso concreto (upload-url | analyze | confirm) lo decide el propio
    // handler leyendo el cuerpo; aca solo se elige el sub-recurso.
    if (accion(request) === "documents") return handleDocumentsPost(request, id);
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "La Fábrica de Normas requiere conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para crear un código nuevo." }, { status: 401 });
  }
  if (!hasPermission(session, "norms.create")) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede crear códigos nuevos." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Revisá el título del código nuevo." }, { status: 400 });
  }

  try {
    const reform = await createReform({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      createdById: session.userId
    });
    return NextResponse.json({ reform }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo crear el código nuevo", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullish(),
  status: z.nativeEnum(ReformStatus).optional()
});

export async function PATCH(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (!id) return NextResponse.json({ error: "Falta el código nuevo" }, { status: 400 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "norms.edit")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const reform = await updateReform(id, parsed.data);
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
    return NextResponse.json({ reform });
  } catch (error) {
    console.error("No se pudo actualizar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo actualizar el código nuevo" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Segments) {
  const id = (await params).segments?.[0] ?? null;
  if (!id) return NextResponse.json({ error: "Falta el código nuevo" }, { status: 400 });

  // Con `?docId=` se borra ESE antecedente; sin el, el codigo nuevo entero.
  const docId = new URL(request.url).searchParams.get("docId");
  if (docId) return handleDocumentDelete(request, id, docId);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "norms.delete")) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo un administrador puede eliminar un código nuevo." }, { status: 403 });
  }

  try {
    // Las normas quedan con reformId en null (SetNull); no se pierden.
    await prisma.normativeReform.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo eliminar el código nuevo" }, { status: 500 });
  }
}
