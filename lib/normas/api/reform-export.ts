import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getNormativeExplorerData } from "@/lib/normative/data";
import { getReform } from "@/lib/projects/data";
import { reformToComparativePrintHtml, reformToPrintHtml } from "@/lib/projects/export";


/**
 * Codigo nuevo en formato PDF: devuelve HTML imprimible ("Guardar como PDF").
 *
 * Sin parametros exporta el codigo consolidado (solo las normas nuevas). Con
 * `?vista=cambios` devuelve el documento COMPARADO: el CPU vigente completo
 * con los articulos eliminados en rojo y las normas nuevas en verde, para
 * revisar la reforma articulo por articulo antes de elevar.
 */
export async function handleReformExport(request: Request, id: string) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const reform = await getReform(id).catch(() => null);
  if (!reform) {
    return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });
  }

  try {
    const texts = await prisma.project.findMany({
      where: { reformId: id },
      select: { id: true, articleText: true }
    });
    const normTexts = new Map(texts.map((norm) => [norm.id, norm.articleText]));

    const comparado = new URL(request.url).searchParams.get("vista") === "cambios";
    const html = comparado
      ? reformToComparativePrintHtml(reform, normTexts, await getNormativeExplorerData().then((cpu) => ({
          versionLabel: cpu.document.versionLabel,
          chapters: cpu.chapters,
          articles: cpu.articles
        })))
      : reformToPrintHtml(reform, normTexts);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    console.error("No se pudo exportar el codigo nuevo", error);
    return NextResponse.json({ error: "No se pudo exportar el código nuevo" }, { status: 500 });
  }
}
