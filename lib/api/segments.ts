import { NextResponse } from "next/server";

/**
 * Ayuda para las rutas que atienden un modulo entero desde un catch-all
 * opcional (`app/api/<modulo>/[[...segments]]/route.ts`).
 *
 * Existen porque el plan Hobby de Vercel admite 12 funciones serverless y cada
 * route.ts cuenta una: la coleccion y el detalle comparten funcion.
 */

/** Firma del segundo argumento de un route handler con catch-all opcional. */
export type SegmentsArg = { params: Promise<{ segments?: string[] }> };

/**
 * El id del recurso, `null` si la URL apunta a la coleccion, o un 404 ya armado
 * si trae MAS segmentos de los que el modulo entiende.
 *
 * Ese ultimo caso es el que importa: un catch-all matchea profundidad
 * ARBITRARIA, asi que /api/hearings/<id>/lo-que-sea entra por el mismo handler
 * que /api/hearings/<id>. Sin este corte los segmentos de mas se descartaban en
 * silencio, y `DELETE /api/hearings/<id>/audio?confirmAudio=1` --una URL
 * plausible de escribir a mano, porque /api/hearings/audio existe al lado--
 * borraba la AUDIENCIA ENTERA con su grabacion en vez de responder 404. Antes de
 * consolidar las rutas esos paths no matcheaban nada.
 *
 * Uso:
 *   const id = await readModuleId(params);
 *   if (id instanceof NextResponse) return id;
 */
export async function readModuleId(params: SegmentsArg["params"]): Promise<string | null | NextResponse> {
  const segments = (await params).segments ?? [];
  if (segments.length > 1) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return segments[0] ?? null;
}
