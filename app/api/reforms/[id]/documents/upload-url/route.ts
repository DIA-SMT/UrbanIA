import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createNormDocumentUploadUrl, hasNormsStorage } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

/** Limite acordado para los PDFs aportados a la reforma. */
const MAX_FILE_BYTES = 30 * 1024 * 1024;

const bodySchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().trim().max(160)
});

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Firma una URL para que el browser suba el PDF DIRECTO al bucket.
 *
 * El archivo no puede pasar por una ruta de Next: Vercel corta el body de una
 * funcion serverless en ~4,5 MB y aca el limite es 30 MB. Por eso el server
 * solo firma la subida y despues recibe el storagePath.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!hasNormsStorage()) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado", detail: "Falta configurar Supabase Storage para guardar los PDF." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Faltan el nombre, el peso o el tipo del archivo." }, { status: 400 });
  }

  const { fileName, sizeBytes } = parsed.data;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Formato no soportado", detail: `"${fileName}" no es un PDF. El importador solo lee PDF.` },
      { status: 415 }
    );
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Archivo demasiado pesado", detail: `"${fileName}" pesa ${formatSize(sizeBytes)} y el límite es 30 MB.` },
      { status: 413 }
    );
  }

  try {
    const reform = await prisma.normativeReform.findUnique({ where: { id }, select: { id: true } });
    if (!reform) return NextResponse.json({ error: "Código nuevo no encontrado" }, { status: 404 });

    const upload = await createNormDocumentUploadUrl({ reformId: id, fileName });
    return NextResponse.json(upload);
  } catch (error) {
    console.error("No se pudo firmar la subida del documento", error);
    return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500 });
  }
}
