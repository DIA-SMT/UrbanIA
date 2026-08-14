import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionActor, getSessionUser, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";


/**
 * Devoluciones internas del equipo sobre una norma. No es participacion ciudadana:
 * los vecinos no opinan sobre normas, por eso todo el endpoint es staff-only,
 * incluida la lectura.
 */

function toView(opinion: { id: string; authorName: string; body: string; createdAt: Date; userId: string | null }) {
  return {
    id: opinion.id,
    authorName: opinion.authorName,
    body: opinion.body,
    userId: opinion.userId,
    createdAt: opinion.createdAt.toISOString()
  };
}

export async function handleOpinionsList(_request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ opinions: [], isLive: false });
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!hasPermission(session, "projects.edit")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    const opinions = await prisma.normOpinion.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json({ opinions: opinions.map(toView), isLive: true });
  } catch (error) {
    console.error("No se pudieron listar las opiniones", error);
    return NextResponse.json({ opinions: [], isLive: false });
  }
}

/**
 * Solo el texto. Quien firma NO viaja en el request: lo pone el servidor desde la
 * sesion. Cuando el nombre lo mandaba el cliente, cualquiera con permiso podia
 * firmar una devolucion a nombre de otra persona.
 */
const createSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export async function handleOpinionCreate(request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "Las devoluciones requieren conexión a la base." },
      { status: 503 }
    );
  }

  // getSessionActor devuelve null si la cuenta ya no existe, asi que cubre de una
  // lo que antes era una consulta aparte para no romper por clave foranea.
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para dejar una devolución." }, { status: 401 });
  }
  if (!hasPermission(actor, "projects.edit")) {
    return NextResponse.json(
      { error: "Sin permisos", detail: "Solo el equipo municipal puede opinar sobre una norma." },
      { status: 403 }
    );
  }  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Escribí el texto de la devolución (máximo 4000 caracteres)." },
      { status: 400 }
    );
  }

  try {
    const norm = await prisma.project.findUnique({ where: { id }, select: { id: true } });

    if (!norm) {
      return NextResponse.json({ error: "Norma inexistente", detail: "La norma que intentás comentar no existe." }, { status: 404 });
    }

    const opinion = await prisma.normOpinion.create({
      data: {
        projectId: id,
        userId: actor.userId,
        // Sello del nombre: la devolucion sigue identificada aunque se borre la
        // cuenta y userId quede en null.
        authorName: actor.name,
        body: parsed.data.body
      }
    });

    return NextResponse.json({ opinion: toView(opinion) }, { status: 201 });
  } catch (error) {
    console.error("No se pudo guardar la opinión", error);
    return NextResponse.json(
      { error: "No se pudo guardar la devolución", detail: "Intentá nuevamente en unos segundos." },
      { status: 500 }
    );
  }
}
