import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getReform } from "@/lib/projects/data";
import { reformToPrintHtml } from "@/lib/projects/export";

export const dynamic = "force-dynamic";

/**
 * Codigo nuevo consolidado en formato PDF: devuelve HTML imprimible que
 * dispara el dialogo de impresion del navegador ("Guardar como PDF").
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }

  const { id } = await params;
  const reform = await getReform(id).catch(() => null);
  if (!reform) {
    return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
  }

  try {
    const texts = await prisma.project.findMany({
      where: { reformId: id },
      select: { id: true, articleText: true }
    });
    const html = reformToPrintHtml(reform, new Map(texts.map((norm) => [norm.id, norm.articleText])));

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    console.error("No se pudo exportar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo exportar el código nuevo" }, { status: 500 });
  }
}
