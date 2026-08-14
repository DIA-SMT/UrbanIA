import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionActor, hasPermission } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";


/**
 * Apoyo (+1) u objecion (-1) del equipo municipal a una norma. Interno: los vecinos
 * no votan normas.
 *
 * Un voto por persona y por norma, y la persona la pone el SERVIDOR desde la
 * sesion. El cliente no manda a nombre de quien vota: si lo mandara, cualquiera
 * con permiso podria votar como otro o varias veces con nombres distintos, que es
 * lo que pasaba con el esquema declarativo anterior (ver la migracion
 * 20260814120000_voto_por_cuenta_de_persona). voterName se sigue guardando, pero
 * como sello para mostrar quien voto sin ir a buscar cada cuenta.
 */

async function readSummary(projectId: string, userId: string) {
  const supports = await prisma.normSupport.findMany({
    where: { projectId },
    select: { userId: true, voterName: true, value: true }
  });

  let supportCount = 0;
  let objectionCount = 0;
  let myValue: 1 | -1 | null = null;

  for (const support of supports) {
    if (support.value > 0) supportCount += 1;
    else if (support.value < 0) objectionCount += 1;
    if (support.userId === userId) myValue = support.value > 0 ? 1 : -1;
  }

  return {
    supportCount,
    objectionCount,
    net: supportCount - objectionCount,
    myValue,
    voters: supports.map((support) => ({ userId: support.userId, voterName: support.voterName, value: support.value }))
  };
}

async function guard() {
  if (!process.env.DATABASE_URL) {
    return { error: NextResponse.json({ error: "Base de datos no disponible" }, { status: 503 }) };
  }
  // getSessionActor y no getSessionUser: hace falta el nombre para el sello, y
  // devuelve null si la cuenta fue borrada, que aca tiene que ser un 401 y no un
  // error de clave foranea al escribir.
  const actor = await getSessionActor();
  if (!actor) {
    return { error: NextResponse.json({ error: "No autenticado", detail: "Iniciá sesión para apoyar una norma." }, { status: 401 }) };
  }
  if (!hasPermission(actor, "projects.edit")) {
    return {
      error: NextResponse.json(
        { error: "Sin permisos", detail: "Solo el equipo municipal puede apoyar u objetar una norma." },
        { status: 403 }
      )
    };
  }
  return { actor };
}

export async function handleSupportGet(_request: Request, id: string) {
  const gate = await guard();
  if (gate.error) return gate.error;

  try {
    return NextResponse.json(await readSummary(id, gate.actor.userId));
  } catch (error) {
    console.error("No se pudo leer el apoyo de la norma", error);
    return NextResponse.json({ error: "No se pudo leer el apoyo" }, { status: 500 });
  }
}

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)])
});

export async function handleSupportCreate(request: Request, id: string) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const parsed = voteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detail: "Mandá un apoyo válido (+1 a favor o -1 en contra)." },
      { status: 400 }
    );
  }

  try {
    const norm = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!norm) {
      return NextResponse.json({ error: "Norma inexistente", detail: "La norma que intentás apoyar no existe." }, { status: 404 });
    }

    await prisma.normSupport.upsert({
      where: { projectId_userId: { projectId: id, userId: gate.actor.userId } },
      create: { projectId: id, userId: gate.actor.userId, voterName: gate.actor.name, value: parsed.data.value },
      // El sello se refresca al revotar: si el nombre de la cuenta cambio, el
      // listado de votantes muestra el actual y no uno viejo.
      update: { value: parsed.data.value, voterName: gate.actor.name }
    });

    return NextResponse.json(await readSummary(id, gate.actor.userId));
  } catch (error) {
    console.error("No se pudo registrar el apoyo", error);
    return NextResponse.json(
      { error: "No se pudo registrar el apoyo", detail: "Intentá nuevamente en unos segundos." },
      { status: 500 }
    );
  }
}

/** Vuelve a neutral: la persona retira su apoyo u objecion. */
export async function handleSupportDelete(_request: Request, id: string) {
  const gate = await guard();
  if (gate.error) return gate.error;

  try {
    // deleteMany y no delete: si no habia voto, delete tira P2025 y esto tiene que
    // ser idempotente (doble click en el boton activo).
    await prisma.normSupport.deleteMany({ where: { projectId: id, userId: gate.actor.userId } });
    return NextResponse.json(await readSummary(id, gate.actor.userId));
  } catch (error) {
    console.error("No se pudo quitar el apoyo", error);
    return NextResponse.json({ error: "No se pudo quitar el apoyo" }, { status: 500 });
  }
}
