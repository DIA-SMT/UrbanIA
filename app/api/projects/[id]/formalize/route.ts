import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { DiagnosisUnavailableError, formalizeNorm } from "@/lib/projects/diagnosis";

export const dynamic = "force-dynamic";

/**
 * Paso 1 de la Fabrica: formalizar. Convierte el objeto escrito en crudo en el
 * texto formal del articulado, usando el CPU 2014 como referencia de estilo.
 * No persiste nada: devuelve la sugerencia y el analista decide si la usa.
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
    const result = await formalizeNorm(id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DiagnosisUnavailableError) {
      return NextResponse.json(
        { error: "Formalización no disponible", detail: "El servicio de IA todavía no está habilitado para esta instancia." },
        { status: 503 }
      );
    }
    console.error("No se pudo formalizar la norma", error);
    return NextResponse.json(
      { error: "No se pudo formalizar la norma", detail: "Intentá nuevamente o ajustá el objeto de la norma." },
      { status: 502 }
    );
  }
}
