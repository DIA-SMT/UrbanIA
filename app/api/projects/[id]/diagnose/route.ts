import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { compareNormWithOldCode, DiagnosisUnavailableError, MissingArticleTextError } from "@/lib/projects/diagnosis";

export const dynamic = "force-dynamic";

/**
 * Paso 2 de la Fabrica: comparar la norma formalizada contra el CPU 2014.
 * La IA detecta los articulos tocados, los ancla automaticamente (sin pisar
 * los anclajes humanos) y produce el analisis de impacto con recomendaciones
 * y conflictos. Devuelve { diagnosis, anchors } para refrescar el panel.
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
    const result = await compareNormWithOldCode(id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MissingArticleTextError) {
      return NextResponse.json(
        { error: "Falta el texto del articulado", detail: "Formalizá la norma antes de compararla con el código viejo." },
        { status: 422 }
      );
    }
    if (error instanceof DiagnosisUnavailableError) {
      return NextResponse.json(
        { error: "Comparación no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
        { status: 503 }
      );
    }
    console.error("No se pudo comparar la norma con el codigo viejo", error);
    return NextResponse.json(
      { error: "No se pudo comparar la norma", detail: "Intentá nuevamente o revisá el texto del articulado." },
      { status: 502 }
    );
  }
}
