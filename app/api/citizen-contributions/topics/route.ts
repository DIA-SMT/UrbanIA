import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { EMPTY_TOPICS_DEMAND } from "@/lib/citizen/shared";
import { getTopicsDemand } from "@/lib/citizen/topics-demand";

export const dynamic = "force-dynamic";

/**
 * Ranking de temas del CPU segun lo que pide la ciudadania.
 *
 * Staff-only aunque sea de lectura: expone el texto de aportes de vecinos
 * identificables, y la decision de producto es que las normas y su insumo son
 * internos del equipo municipal.
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(EMPTY_TOPICS_DEMAND);
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado", detail: "Iniciá sesión para ver los temas más pedidos." },
      { status: 401 }
    );
  }
  if (!isStaff(session.role)) {
    return NextResponse.json(
      { error: "Sin permisos", detail: "Solo el equipo municipal puede ver los aportes ciudadanos agregados." },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json(await getTopicsDemand());
  } catch (error) {
    console.error("No se pudo calcular la demanda por tema", error);
    return NextResponse.json(EMPTY_TOPICS_DEMAND);
  }
}
