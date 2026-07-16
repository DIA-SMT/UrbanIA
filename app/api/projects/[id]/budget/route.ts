import { BudgetCostType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import type { ProjectBudgetItemView } from "@/lib/projects/shared";

export const dynamic = "force-dynamic";

function toView(item: {
  id: string;
  concept: string;
  costType: BudgetCostType;
  baseAmount: unknown;
  multiplier: number;
  fundingSource: string | null;
  amount: unknown;
  createdAt: Date;
}): ProjectBudgetItemView {
  return {
    id: item.id,
    concept: item.concept,
    costType: item.costType,
    baseAmount: Number(item.baseAmount),
    multiplier: item.multiplier,
    fundingSource: item.fundingSource,
    amount: Number(item.amount),
    createdAt: item.createdAt.toISOString()
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ items: [], isLive: false });
  }
  const { id } = await params;
  const items = await prisma.projectBudgetItem.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ items: items.map(toView), isLive: true });
}

const postSchema = z.object({
  concept: z.string().trim().min(1).max(300),
  costType: z.nativeEnum(BudgetCostType),
  baseAmount: z.number().nonnegative().max(1_000_000_000_000),
  multiplier: z.number().positive().max(20),
  fundingSource: z.string().trim().max(200).nullish()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  try {
    // El monto se calcula SIEMPRE en el server; nunca se confia en el cliente.
    const amount = Math.round(parsed.data.baseAmount * parsed.data.multiplier * 100) / 100;
    const item = await prisma.projectBudgetItem.create({
      data: {
        projectId: id,
        concept: parsed.data.concept,
        costType: parsed.data.costType,
        baseAmount: parsed.data.baseAmount,
        multiplier: parsed.data.multiplier,
        fundingSource: parsed.data.fundingSource ?? null,
        amount
      }
    });
    return NextResponse.json({ item: toView(item) }, { status: 201 });
  } catch (error) {
    console.error("No se pudo agregar el item de presupuesto", error);
    return NextResponse.json({ error: "No se pudo agregar el item" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isStaff(session.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "Falta el item" }, { status: 400 });
  }

  try {
    await prisma.projectBudgetItem.deleteMany({ where: { id: itemId, projectId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar el item de presupuesto", error);
    return NextResponse.json({ error: "No se pudo eliminar el item" }, { status: 500 });
  }
}
