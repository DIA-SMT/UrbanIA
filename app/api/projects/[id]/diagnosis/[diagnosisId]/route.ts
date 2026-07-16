import { FeasibilityLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import type { ProjectCitedArticle, ProjectDiagnosisView } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  feasibility: z.nativeEnum(FeasibilityLevel).optional(),
  scope: z.string().trim().min(1).max(400).optional(),
  objective: z.string().trim().min(1).max(800).optional(),
  analysis: z.string().trim().min(1).max(12000).optional(),
  actions: z.array(z.string().trim().min(1)).max(12).optional(),
  risks: z.array(z.string().trim().min(1)).max(12).optional()
});

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asCitedArticles(value: unknown): ProjectCitedArticle[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ articleId: String(item.articleId ?? ""), articleNumber: String(item.articleNumber ?? ""), quote: String(item.quote ?? "") }))
    .filter((item) => item.articleId && item.quote);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; diagnosisId: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, diagnosisId } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const existing = await prisma.projectDiagnosis.findFirst({ where: { id: diagnosisId, projectId: id } });
  if (!existing) {
    return NextResponse.json({ error: "Diagnostico no encontrado" }, { status: 404 });
  }

  try {
    const updated = await prisma.projectDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        editedByHuman: true,
        ...(parsed.data.feasibility !== undefined ? { feasibility: parsed.data.feasibility } : {}),
        ...(parsed.data.scope !== undefined ? { scope: parsed.data.scope } : {}),
        ...(parsed.data.objective !== undefined ? { objective: parsed.data.objective } : {}),
        ...(parsed.data.analysis !== undefined ? { analysis: parsed.data.analysis } : {}),
        ...(parsed.data.actions !== undefined ? { actions: parsed.data.actions } : {}),
        ...(parsed.data.risks !== undefined ? { risks: parsed.data.risks } : {})
      }
    });

    const view: ProjectDiagnosisView = {
      id: updated.id,
      version: updated.version,
      feasibility: updated.feasibility,
      scope: updated.scope,
      objective: updated.objective,
      analysis: updated.analysis,
      actions: asStringArray(updated.actions),
      risks: asStringArray(updated.risks),
      citedArticles: asCitedArticles(updated.citedArticles),
      model: updated.model,
      editedByHuman: updated.editedByHuman,
      createdAt: updated.createdAt.toISOString()
    };

    return NextResponse.json({ diagnosis: view });
  } catch (error) {
    console.error("No se pudo editar el diagnostico", error);
    return NextResponse.json({ error: "No se pudo editar el diagnostico" }, { status: 500 });
  }
}
