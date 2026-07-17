import { NextResponse } from "next/server";
import { getNorm } from "@/lib/projects/data";
import { normToPrintHtml } from "@/lib/projects/export";

export const dynamic = "force-dynamic";

/**
 * Una norma individual en formato PDF: devuelve HTML imprimible que dispara
 * el dialogo de impresion del navegador ("Guardar como PDF").
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }

  const { id } = await params;
  const norm = await getNorm(id).catch(() => null);
  if (!norm) {
    return NextResponse.json({ error: "Norma no encontrada" }, { status: 404 });
  }

  try {
    const html = normToPrintHtml(norm);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    console.error("No se pudo exportar la norma", error);
    return NextResponse.json({ error: "No se pudo exportar la norma" }, { status: 500 });
  }
}
