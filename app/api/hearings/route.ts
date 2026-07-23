import { HearingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaff } from "@/lib/auth/api";
import { createHearing, getHearingCounts, listHearings, type HearingFilters } from "@/lib/hearings/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ hearings: [], counts: { upcoming: 0, processing: 0, completed: 0 }, isLive: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && (Object.values(HearingStatus) as string[]).includes(statusParam) ? (statusParam as HearingStatus) : undefined;
    const reformId = searchParams.get("reformId") ?? undefined;

    const filters: HearingFilters = { status, reformId };
    const [hearings, counts] = await Promise.all([listHearings(filters), getHearingCounts()]);
    return NextResponse.json({ hearings, counts, isLive: true });
  } catch (error) {
    console.error("No se pudieron listar las audiencias", error);
    return NextResponse.json({ hearings: [], counts: { upcoming: 0, processing: 0, completed: 0 }, isLive: false });
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  occurredAt: z.string().datetime().nullish(),
  modality: z.string().trim().max(80).nullish(),
  location: z.string().trim().max(200).nullish(),
  reformId: z.string().trim().min(1).max(60).nullish(),
  topic: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(8000).nullish()
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Base de datos no disponible", detail: "El registro de audiencias requiere conexión a la base." },
      { status: 503 }
    );
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para registrar una audiencia." }, { status: 401 });
  if (!isStaff(session.role)) {
    return NextResponse.json({ error: "Sin permisos", detail: "Solo el equipo municipal puede registrar audiencias." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: "Revisá el título y los datos de la audiencia." }, { status: 400 });
  }

  // Se necesita un tema: un código nuevo (con cruce) o un tema libre (sin cruce).
  if (!parsed.data.reformId && !parsed.data.topic) {
    return NextResponse.json({ error: "Falta el tema", detail: "Elegí un código nuevo o escribí un tema a tratar." }, { status: 400 });
  }

  try {
    const hearing = await createHearing({
      title: parsed.data.title,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
      modality: parsed.data.modality ?? null,
      location: parsed.data.location ?? null,
      reformId: parsed.data.reformId ?? null,
      topic: parsed.data.reformId ? null : (parsed.data.topic ?? null),
      description: parsed.data.description ?? null
    });
    return NextResponse.json({ hearing }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear la audiencia", error);
    return NextResponse.json({ error: "No se pudo crear la audiencia", detail: "Intentá nuevamente en unos segundos." }, { status: 500 });
  }
}
