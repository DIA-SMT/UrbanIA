import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { siditucProvider } from "@/lib/auth/identity/sidituc";
import { getSettingsSession, requestMetadata } from "@/lib/settings/guard";
import { roleLabels, statusLabels } from "@/lib/settings/shared";
import type { AuditAction } from "@/lib/settings/audit";

const changeRoleSchema = z.object({
  action: z.literal("change-role"),
  newRole: z.nativeEnum(UserRole),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500)
});

const statusSchema = z.object({
  action: z.enum(["suspend", "reactivate", "revoke"]),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500)
});

const profileSchema = z.object({
  action: z.literal("update-profile"),
  lastName: z.string().trim().max(80).nullable().optional(),
  areaId: z.string().trim().nullable().optional(),
  dependencyId: z.string().trim().nullable().optional()
});

const bodySchema = z.discriminatedUnion("action", [changeRoleSchema, statusSchema, profileSchema]);

/**
 * PATCH /api/settings/users/[id]. Toda mutación queda en UserAuditLog con
 * actor, IP y dispositivo; el registro y el cambio van en la misma
 * transacción para que no exista cambio sin bitácora.
 */
export async function handleUserAction(request: Request, userId: string) {
  const session = await getSettingsSession("users.manage");
  if (!session) {
    return NextResponse.json({ error: "Necesitás permisos de administración de usuarios." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, lastName: true, areaId: true, dependencyId: true }
  });
  if (!target) {
    return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
  }

  const body = parsed.data;
  const { ip, userAgent } = requestMetadata(request);
  const auditBase = { actorId: session.userId, targetUserId: target.id, ip, userAgent };

  // Protecciones de continuidad: nadie se quita el acceso a sí mismo, y el
  // sistema nunca queda sin administradores activos.
  const actsOnSelf = target.id === session.userId;
  const removesAdminAccess =
    target.role === "ADMIN" &&
    ((body.action === "change-role" && body.newRole !== "ADMIN") || body.action === "suspend" || body.action === "revoke");

  if (actsOnSelf && body.action !== "update-profile") {
    return NextResponse.json({ error: "No podés modificar tu propio rol o estado. Pedile a otro administrador que lo haga." }, { status: 409 });
  }

  if (removesAdminAccess) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: target.id } }
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json({ error: "Es el único administrador activo: asigná otro administrador antes de quitarle el acceso." }, { status: 409 });
    }
  }

  if (body.action === "change-role") {
    if (body.newRole === target.role) {
      return NextResponse.json({ error: "El usuario ya tiene ese rol." }, { status: 400 });
    }
    await auditedUpdate(target.id, { role: body.newRole }, {
      ...auditBase,
      action: "ROLE_CHANGED" satisfies AuditAction,
      previousValue: roleLabels[target.role],
      newValue: roleLabels[body.newRole],
      reason: body.reason
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "suspend" || body.action === "revoke" || body.action === "reactivate") {
    const nextStatus = body.action === "suspend" ? "SUSPENDED" : body.action === "revoke" ? "REVOKED" : "ACTIVE";
    if (target.status === nextStatus) {
      return NextResponse.json({ error: `El usuario ya está ${statusLabels[nextStatus].toLowerCase()}.` }, { status: 400 });
    }
    const auditAction: AuditAction =
      body.action === "suspend" ? "USER_SUSPENDED" : body.action === "revoke" ? "ACCESS_REVOKED" : "USER_REACTIVATED";
    await auditedUpdate(target.id, { status: nextStatus }, {
      ...auditBase,
      action: auditAction,
      previousValue: statusLabels[target.status],
      newValue: statusLabels[nextStatus],
      reason: body.reason
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "update-profile") {
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  }

  // update-profile: solo campos administrativos (apellido, área, dependencia).
  const data: { lastName?: string | null; areaId?: string | null; dependencyId?: string | null } = {};
  if (body.lastName !== undefined) data.lastName = body.lastName || null;
  if (body.areaId !== undefined) data.areaId = body.areaId || null;
  if (body.dependencyId !== undefined) data.dependencyId = body.dependencyId || null;

  // La dependencia debe pertenecer al área elegida; si cambia el área sin
  // dependencia nueva, la anterior deja de tener sentido y se limpia.
  if (data.dependencyId) {
    const dependency = await prisma.dependency.findUnique({ where: { id: data.dependencyId }, select: { areaId: true } });
    const areaId = data.areaId !== undefined ? data.areaId : target.areaId;
    if (!dependency || dependency.areaId !== areaId) {
      return NextResponse.json({ error: "La dependencia no pertenece al área seleccionada." }, { status: 400 });
    }
  } else if (data.areaId !== undefined && data.areaId !== target.areaId && data.dependencyId === undefined) {
    data.dependencyId = null;
  }

  await auditedUpdate(target.id, data, {
    ...auditBase,
    action: "PROFILE_UPDATED" satisfies AuditAction,
    previousValue: JSON.stringify({ lastName: target.lastName, areaId: target.areaId, dependencyId: target.dependencyId }),
    newValue: JSON.stringify({ ...{ lastName: target.lastName, areaId: target.areaId, dependencyId: target.dependencyId }, ...data }),
    reason: null
  });
  return NextResponse.json({ ok: true });
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  lastName: z.string().trim().min(1, "El apellido es obligatorio").max(80),
  email: z.string().trim().toLowerCase().email("El correo no es válido"),
  occupation: z.string().trim().max(120).optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(100),
  role: z.nativeEnum(UserRole),
  areaId: z.string().trim().nullable().optional(),
  dependencyId: z.string().trim().nullable().optional()
});

/**
 * POST /api/settings?action=create-user. Alta manual PROVISORIA: existe solo
 * hasta que la integración SIDITUC esté activa; con el flag prendido se
 * bloquea, porque ahí las cuentas deben nacer de la vinculación de identidad.
 */
export async function handleUserCreate(request: Request) {
  const session = await getSettingsSession("users.manage");
  if (!session) {
    return NextResponse.json({ error: "Necesitás permisos de administración de usuarios." }, { status: 403 });
  }

  if (siditucProvider.isEnabled()) {
    return NextResponse.json(
      { error: "El alta manual está deshabilitada: con SIDITUC activo, las cuentas se vinculan desde Solicitudes de acceso." },
      { status: 409 }
    );
  }

  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const body = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  }

  if (body.dependencyId) {
    const dependency = await prisma.dependency.findUnique({ where: { id: body.dependencyId }, select: { areaId: true } });
    if (!dependency || dependency.areaId !== body.areaId) {
      return NextResponse.json({ error: "La dependencia no pertenece al área seleccionada." }, { status: 400 });
    }
  }

  const passwordHash = await hashPassword(body.password);
  const { ip, userAgent } = requestMetadata(request);

  // Alta y bitácora en la misma transacción, como toda mutación del módulo:
  // no existe cuenta creada sin su asiento de auditoría.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: body.name,
        lastName: body.lastName,
        email: body.email,
        occupation: body.occupation || null,
        passwordHash,
        role: body.role,
        status: "ACTIVE",
        areaId: body.areaId || null,
        dependencyId: body.dependencyId || null
      }
    });
    await tx.userAuditLog.create({
      data: {
        actorId: session.userId,
        targetUserId: created.id,
        action: "USER_CREATED" satisfies AuditAction,
        previousValue: null,
        newValue: roleLabels[body.role],
        reason: "Alta manual provisoria (SIDITUC pendiente)",
        ip,
        userAgent
      }
    });
    return created;
  });

  return NextResponse.json({ ok: true, userId: user.id });
}

type AuditEntry = {
  actorId: string;
  targetUserId: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
};

function auditedUpdate(
  userId: string,
  data: Parameters<typeof prisma.user.update>[0]["data"],
  audit: AuditEntry
) {
  return prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data }),
    prisma.userAuditLog.create({ data: audit })
  ]);
}
