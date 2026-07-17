import { ReformStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createReform, listReforms } from "@/lib/projects/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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
  if (!isStaff(session.role)) {
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
