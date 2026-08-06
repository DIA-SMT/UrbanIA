import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { DebateStance, DebateStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/api";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ARGUMENT_MAX_LENGTH, ARGUMENT_MIN_LENGTH } from "@/lib/foro/shared";

/** Mutaciones del foro. Las lecturas son SSR (lib/foro/data.ts). */

async function requirePermission(permission: Permission) {
  const session = await getSessionUser();
  if (!session || !hasPermission(session.role, permission)) return null;
  return session;
}

const createSchema = z.object({
  title: z.string().trim().min(10, "El título debe tener al menos 10 caracteres").max(200),
  context: z.string().trim().min(20, "El contexto debe tener al menos 20 caracteres").max(4000),
  meetingId: z.string().trim().min(1, "Elegí la audiencia de origen del debate"),
  closesAt: z.string().trim().optional(),
  proposalId: z.string().trim().nullable().optional(),
  projectId: z.string().trim().nullable().optional()
});

export async function handleDebateCreate(request: Request) {
  const session = await requirePermission("debates.create");
  if (!session) {
    return NextResponse.json({ error: "Solo un administrador puede crear debates." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const body = parsed.data;

  if (body.proposalId && body.projectId) {
    return NextResponse.json({ error: "Elegí un solo vínculo: propuesta o proyecto." }, { status: 400 });
  }

  // Todo debate nace de una audiencia: es su contexto y su trazabilidad.
  const meeting = await prisma.meeting.findFirst({
    where: { id: body.meetingId, kind: "PUBLIC_HEARING" },
    select: { id: true }
  });
  if (!meeting) {
    return NextResponse.json({ error: "La audiencia elegida no existe." }, { status: 400 });
  }

  let closesAt: Date | null = null;
  if (body.closesAt) {
    closesAt = new Date(`${body.closesAt}T23:59:59`);
    if (Number.isNaN(closesAt.getTime()) || closesAt < new Date()) {
      return NextResponse.json({ error: "La fecha de cierre debe ser futura." }, { status: 400 });
    }
  }

  const debate = await prisma.debate.create({
    data: {
      title: body.title,
      context: body.context,
      meetingId: meeting.id,
      closesAt,
      proposalId: body.proposalId || null,
      projectId: body.projectId || null,
      createdById: session.userId
    }
  });

  return NextResponse.json({ ok: true, debateId: debate.id });
}

const statusSchema = z.object({
  debateId: z.string(),
  status: z.nativeEnum(DebateStatus)
});

export async function handleDebateStatusChange(request: Request) {
  const session = await requirePermission("debates.create");
  if (!session) {
    return NextResponse.json({ error: "Solo un administrador puede cambiar el estado de un debate." }, { status: 403 });
  }

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const debate = await prisma.debate.findUnique({ where: { id: parsed.data.debateId }, select: { id: true } });
  if (!debate) {
    return NextResponse.json({ error: "El debate no existe." }, { status: 404 });
  }

  await prisma.debate.update({ where: { id: debate.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ ok: true });
}

const argumentSchema = z.object({
  debateId: z.string(),
  stance: z.nativeEnum(DebateStance),
  content: z
    .string()
    .trim()
    .min(ARGUMENT_MIN_LENGTH, `El argumento debe tener al menos ${ARGUMENT_MIN_LENGTH} caracteres`)
    .max(ARGUMENT_MAX_LENGTH)
});

export async function handleArgumentCreate(request: Request) {
  const session = await requirePermission("debates.participate");
  if (!session) {
    return NextResponse.json({ error: "Tu rol no participa en debates (solo lectura)." }, { status: 403 });
  }

  const parsed = argumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const debate = await prisma.debate.findUnique({
    where: { id: parsed.data.debateId },
    select: { status: true, closesAt: true }
  });
  if (!debate) {
    return NextResponse.json({ error: "El debate no existe." }, { status: 404 });
  }
  if (debate.status !== "OPEN" || (debate.closesAt && debate.closesAt < new Date())) {
    return NextResponse.json({ error: "El debate está cerrado: no admite nuevos argumentos." }, { status: 409 });
  }

  await prisma.debateArgument.create({
    data: {
      debateId: parsed.data.debateId,
      authorId: session.userId,
      stance: parsed.data.stance,
      content: parsed.data.content
    }
  });

  return NextResponse.json({ ok: true });
}

const supportSchema = z.object({ argumentId: z.string() });

/** Adhesión con toggle: si ya adherías, la quita. Una por usuario por argumento. */
export async function handleSupportToggle(request: Request) {
  const session = await requirePermission("debates.participate");
  if (!session) {
    return NextResponse.json({ error: "Tu rol no participa en debates (solo lectura)." }, { status: 403 });
  }

  const parsed = supportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const argument = await prisma.debateArgument.findUnique({
    where: { id: parsed.data.argumentId },
    select: { id: true, status: true, authorId: true, debate: { select: { status: true } } }
  });
  if (!argument || argument.status !== "VISIBLE") {
    return NextResponse.json({ error: "El argumento no está disponible." }, { status: 404 });
  }
  if (argument.debate.status !== "OPEN") {
    return NextResponse.json({ error: "El debate está cerrado." }, { status: 409 });
  }
  if (argument.authorId === session.userId) {
    return NextResponse.json({ error: "No podés adherir a tu propio argumento." }, { status: 409 });
  }

  const existing = await prisma.debateArgumentSupport.findUnique({
    where: { argumentId_userId: { argumentId: argument.id, userId: session.userId } }
  });

  if (existing) {
    await prisma.debateArgumentSupport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, supported: false });
  }

  await prisma.debateArgumentSupport.create({
    data: { argumentId: argument.id, userId: session.userId }
  });
  return NextResponse.json({ ok: true, supported: true });
}

const moderateSchema = z.object({
  argumentId: z.string(),
  hide: z.boolean(),
  reason: z.string().trim().max(300).optional()
});

export async function handleArgumentModerate(request: Request) {
  const session = await requirePermission("debates.moderate");
  if (!session) {
    return NextResponse.json({ error: "Necesitás permisos de moderación." }, { status: 403 });
  }

  const parsed = moderateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  if (parsed.data.hide && !parsed.data.reason?.trim()) {
    return NextResponse.json({ error: "Para ocultar un argumento hace falta un motivo." }, { status: 400 });
  }

  const argument = await prisma.debateArgument.findUnique({ where: { id: parsed.data.argumentId }, select: { id: true } });
  if (!argument) {
    return NextResponse.json({ error: "El argumento no existe." }, { status: 404 });
  }

  await prisma.debateArgument.update({
    where: { id: argument.id },
    data: parsed.data.hide
      ? { status: "HIDDEN", hiddenById: session.userId, hiddenReason: parsed.data.reason }
      : { status: "VISIBLE", hiddenById: null, hiddenReason: null }
  });

  return NextResponse.json({ ok: true });
}
