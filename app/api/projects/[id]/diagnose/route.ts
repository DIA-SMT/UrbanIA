import { NextResponse } from "next/server";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { DiagnosisUnavailableError, generateProjectDiagnosis } from "@/lib/projects/diagnosis";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  try {
    const diagnosis = await generateProjectDiagnosis(id);
    return NextResponse.json({ diagnosis }, { status: 201 });
  } catch (error) {
    if (error instanceof DiagnosisUnavailableError) {
      return NextResponse.json(
        { error: "Diagnostico no disponible", detail: "El servicio de IA todavia no esta habilitado para esta instancia." },
        { status: 503 }
      );
    }
    console.error("No se pudo generar el diagnostico", error);
    return NextResponse.json(
      { error: "No se pudo generar el diagnostico", detail: "Intenta nuevamente o revisa la normativa anclada." },
      { status: 502 }
    );
  }
}
