import { AppFeedbackStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth/api";
import { moderateContribution } from "@/lib/moderation";
import { FEEDBACK_KINDS, kindToDb } from "@/lib/feedback/shared";

/*
 * Recomendaciones sobre UrbanIA como herramienta.
 *
 * Vive dentro de /api/citizen-contributions y no en su propia ruta: el plan
 * Hobby de Vercel admite 12 funciones serverless por deploy, cada route.ts
 * cuenta una y el proyecto ya esta en 12 exactas. Entra por `?action=feedback`.
 * Es la misma solucion que ya usan el PATCH y el DELETE de una contribucion.
 */

// El texto es lo unico que se escribe: el nombre sale de la cuenta, igual que en
// el aporte ciudadano. Un formulario que pide el nombre invita a poner otro.
const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  text: z.string().trim().min(10).max(4000)
});

export async function handleAppFeedbackCreate(request: Request): Promise<NextResponse> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "La base de datos no esta configurada." }, { status: 503 });
  }

  // Misma puerta que presentar un aporte: alcanza con tener cuenta. Opinar sobre
  // la herramienta no es un permiso del catalogo, es algo que puede hacer
  // cualquier vecino que entro con Cidituc.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Ingresá con tu cuenta para dejar tu recomendación." },
      { status: 401 }
    );
  }

  const author = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true }
  });
  if (!author) {
    return NextResponse.json({ error: "No encontramos tu cuenta. Volvé a ingresar." }, { status: 401 });
  }

  try {
    const payload = feedbackSchema.parse(await request.json());

    /*
     * Solo el filtro lexico, que es local y no cuesta nada. El aporte ciudadano
     * ademas manda el texto a la IA para detectar agresion (analyzeAggression),
     * y aca NO se hace: eso protege sobre todo a lo que se publica, y esto no se
     * publica --lo lee el equipo municipal y nada mas--. Sumarle una llamada paga
     * a cada recomendacion seria pagar por una defensa que este circuito no
     * necesita. Si algun dia estas recomendaciones se muestran en el portal, hay
     * que agregar analyzeAggression ANTES de publicarlas.
     */
    const verdict = moderateContribution(payload.text);
    if (verdict.blocked) {
      console.info("Recomendacion bloqueada por moderacion lexica.", { matched: verdict.matched });
      return NextResponse.json({ error: verdict.message }, { status: 422 });
    }

    const feedback = await prisma.appFeedback.create({
      data: {
        kind: kindToDb[payload.kind],
        text: payload.text,
        name: author.name,
        userId: session.userId,
        status: AppFeedbackStatus.NEW
      },
      select: { id: true }
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Contanos un poco más: la recomendación necesita al menos 10 caracteres." },
        { status: 400 }
      );
    }
    console.error("No se pudo guardar la recomendación.", error);
    return NextResponse.json({ error: "No pudimos guardar tu recomendación." }, { status: 500 });
  }
}

/** Cambio de estado desde la bandeja interna (leída / archivada / vuelta a nueva). */
const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.nativeEnum(AppFeedbackStatus)
});

export async function handleAppFeedbackStatus(request: Request): Promise<NextResponse> {
  const session = await getSessionUser();
  // proposals.manage y no audit.view: la bandeja muestra el nombre y el correo de
  // quien escribio, igual que la de aportes. Es el permiso con el que el proyecto
  // ya gobierna "leer lo que mandan los vecinos con sus datos".
  if (!session || !hasPermission(session, "proposals.manage")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const payload = statusSchema.parse(await request.json());
    await prisma.appFeedback.update({
      where: { id: payload.id },
      data: { status: payload.status }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo cambiar el estado de la recomendación.", error);
    return NextResponse.json({ error: "No pudimos actualizar la recomendación." }, { status: 500 });
  }
}
