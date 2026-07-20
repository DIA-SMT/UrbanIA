import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ opinions: [], isLive: false });
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;

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

const createSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "Las devoluciones requieren conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para dejar una devolución." }, { status: 401 });
  }
  if (!isStaff(session.role)) {
    return NextResponse.json(
      { error: "Sin permisos", detail: "Solo el equipo municipal puede opinar sobre una norma." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Escribí el texto de la devolución (máximo 4000 caracteres)." },
      { status: 400 }
    );
  }

  try {
    // El nombre no viaja en la sesion (solo userId y role), asi que se resuelve
    // contra la base y se guarda como snapshot: la devolucion queda identificada
    // aunque despues se borre la cuenta.
    const [norm, author] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } })
    ]);

    if (!norm) {
      return NextResponse.json({ error: "Norma inexistente", detail: "La norma que intentás comentar no existe." }, { status: 404 });
    }
    if (!author) {
      return NextResponse.json({ error: "No autenticado", detail: "No encontramos tu cuenta. Volvé a ingresar." }, { status: 401 });
    }

    const opinion = await prisma.normOpinion.create({
      data: {
        projectId: id,
        userId: session.userId,
        authorName: author.name,
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
