import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/settings?action=keepalive — latido para que Supabase no pause la base.
 *
 * Supabase Free pausa el proyecto cuando no ve "sufficient user database
 * activity" en una semana, y su doc dice que alcanzan "a few user requests to the
 * database each day". No publica un umbral ni qué vías cuentan. El keepalive
 * viejo (un SELECT 1 por el pooler cada 3 días desde GitHub Actions) daba verde y
 * la base se pausó igual entre el 22 y el 25/09/2026.
 *
 * Por eso cada latido toca la base por las DOS vías que usa un cliente real, con
 * consultas a tablas de verdad:
 *   - Prisma, por el pooler (el mismo camino que toda la app);
 *   - la Data API (PostgREST, /rest/v1), la vía HTTP de Supabase.
 * Si cualquiera de las dos falla responde 500, para que quien lo llame se entere.
 *
 * Lo llaman el cron de Vercel (vercel.json, una vez por día: es el tope de Hobby)
 * y GitHub Actions (.github/workflows/keepalive-supabase.yml, cada 6 horas). Los
 * dos mandan `Authorization: Bearer <CRON_SECRET>`: Vercel lo agrega solo cuando
 * la variable existe en el proyecto.
 */

/** Tabla que lee la Data API: capas del mapa, datos públicos y chicos. */
const TABLA_REST = "UrbanLayer";
const TIMEOUT_MS = 15_000;

/** True si la request trae el secreto del cron. Comparación en tiempo constante. */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secret}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

type Resultado = { ok: true; ms: number } | { ok: false; ms: number; error: string };

async function medir(tarea: () => Promise<void>): Promise<Resultado> {
  const inicio = Date.now();
  try {
    await tarea();
    return { ok: true, ms: Date.now() - inicio };
  } catch (error) {
    return { ok: false, ms: Date.now() - inicio, error: error instanceof Error ? error.message : String(error) };
  }
}

async function tocarConPrisma(): Promise<void> {
  try {
    await Promise.all([prisma.urbanLayer.count(), prisma.user.count()]);
  } catch (error) {
    // El mensaje de Prisma trae el host del pooler y el usuario de la base. Va
    // al log del servidor y NO a la respuesta: el workflow de GitHub la imprime,
    // y el repo es público. Afuera sale solo el código (P1001, P1000...).
    console.error("Keepalive: falló la consulta por Prisma", error);
    const { code, errorCode } = error as { code?: string; errorCode?: string };
    const codigo = code ?? errorCode;
    throw new Error(codigo ? `Prisma respondió ${codigo}` : "Prisma respondió con error");
  }
}

async function tocarConDataApi(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${url}/rest/v1/${TABLA_REST}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  // 540 es la respuesta documentada de Supabase para un proyecto pausado.
  if (response.status === 540) throw new Error("Supabase responde 540: el proyecto está pausado");
  if (!response.ok) throw new Error(`La Data API respondió ${response.status}`);
  const filas: unknown = await response.json();
  if (!Array.isArray(filas)) throw new Error("La Data API no devolvió una lista");
}

export async function handleKeepalive() {
  const [prismaResultado, dataApi] = await Promise.all([medir(tocarConPrisma), medir(tocarConDataApi)]);
  const ok = prismaResultado.ok && dataApi.ok;
  if (!ok) {
    console.error("Keepalive de Supabase con fallas", { prisma: prismaResultado, dataApi });
  }
  return NextResponse.json(
    { ok, at: new Date().toISOString(), prisma: prismaResultado, dataApi },
    { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } }
  );
}
