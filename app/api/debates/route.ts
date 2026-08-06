import { NextResponse } from "next/server";
import {
  handleArgumentCreate,
  handleArgumentModerate,
  handleDebateCreate,
  handleDebateStatusChange,
  handleSupportToggle
} from "@/lib/foro/api/debates";

export const dynamic = "force-dynamic";

/*
 * Mutaciones del foro de debates, con la operación en `action` (una sola
 * función serverless, como /api/settings). Las lecturas son SSR.
 *
 * POST ?action=create    → crear debate (admin)
 * POST ?action=status    → abrir/cerrar/archivar (admin)
 * POST ?action=argument  → publicar argumento con postura
 * POST ?action=support   → adherir / quitar adhesión (toggle)
 * POST ?action=moderate  → ocultar/restaurar argumento (con motivo)
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "create":
        return await handleDebateCreate(request);
      case "status":
        return await handleDebateStatusChange(request);
      case "argument":
        return await handleArgumentCreate(request);
      case "support":
        return await handleSupportToggle(request);
      case "moderate":
        return await handleArgumentModerate(request);
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Fallo la API del foro", error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
