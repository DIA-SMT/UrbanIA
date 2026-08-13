import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSettingsSession, requestMetadata } from "@/lib/settings/guard";
import { PERMISSION_CATALOG, type Permission } from "@/lib/auth/permissions";
import { loadPermissionMatrix } from "@/lib/auth/permissions-store";
import { roleLabels } from "@/lib/settings/shared";
import type { AuditAction } from "@/lib/settings/audit";

const CATALOGO = new Map(PERMISSION_CATALOG.map((permission) => [permission.key as string, permission]));

const cambioSchema = z.object({
  role: z.nativeEnum(UserRole),
  permission: z.string().refine((clave) => CATALOGO.has(clave), {
    message: "Ese permiso no existe en el catálogo."
  }),
  granted: z.boolean()
});

const bodySchema = z.object({
  action: z.literal("save-permissions"),
  changes: z.array(cambioSchema).min(1, "No hay cambios para guardar.").max(200)
});

/**
 * PATCH /api/settings?action=role-permissions — guarda cambios de la matriz.
 *
 * Recibe un DELTA, no la matriz entera: si dos administradores editan a la vez,
 * cada uno pisa solo las casillas que tocó y no revierte en silencio las del otro.
 *
 * Cada cambio queda en UserAuditLog, en la misma transacción que el cambio, para
 * que no exista modificación de permisos sin bitácora (mismo criterio que
 * lib/settings/api/user-actions.ts).
 */
export async function handleRolePermissions(request: Request) {
  const session = await getSettingsSession("roles.manage");
  if (!session) {
    return NextResponse.json({ error: "Necesitás permisos de administración de roles." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const matriz = await loadPermissionMatrix();

  // Solo los cambios REALES: una casilla que ya estaba como se pide no genera
  // fila de auditoría ni escritura.
  const cambios = parsed.data.changes.filter((cambio) => {
    const actual = matriz.get(cambio.role)?.has(cambio.permission as Permission) ?? false;
    return actual !== cambio.granted;
  });

  if (cambios.length === 0) {
    return NextResponse.json({ ok: true, aplicados: 0 });
  }

  const rechazo = await verificarContinuidad(matriz, cambios);
  if (rechazo) return rechazo;

  const { ip, userAgent } = requestMetadata(request);

  await prisma.$transaction([
    ...cambios.map((cambio) =>
      cambio.granted
        ? prisma.rolePermission.upsert({
            where: { role_permission: { role: cambio.role, permission: cambio.permission } },
            create: { role: cambio.role, permission: cambio.permission },
            update: {}
          })
        : prisma.rolePermission.deleteMany({
            where: { role: cambio.role, permission: cambio.permission }
          })
    ),
    ...cambios.map((cambio) => {
      const etiqueta = `${roleLabels[cambio.role]} · ${CATALOGO.get(cambio.permission)?.label ?? cambio.permission}`;
      return prisma.userAuditLog.create({
        data: {
          actorId: session.userId,
          // El cambio es sobre un rol, no sobre una persona.
          targetUserId: null,
          action: (cambio.granted
            ? "ROLE_PERMISSION_GRANTED"
            : "ROLE_PERMISSION_REVOKED") satisfies AuditAction,
          previousValue: cambio.granted ? null : etiqueta,
          newValue: cambio.granted ? etiqueta : null,
          reason: null,
          ip,
          userAgent
        }
      });
    })
  ]);

  return NextResponse.json({ ok: true, aplicados: cambios.length });
}

/**
 * La única casilla que el sistema se niega a guardar.
 *
 * Si después del cambio no queda NINGUNA cuenta activa cuyo rol tenga
 * `roles.manage`, nadie puede volver a abrir esta pantalla: es una cerradura que
 * se traga la llave, y solo se sale tocando la base a mano. Se chequea contra
 * usuarios reales y no contra la configuración de roles, por la misma razón que
 * user-actions.ts cuenta administradores activos en vez de mirar el enum: lo que
 * importa es que exista alguien que efectivamente pueda entrar a arreglarlo.
 */
async function verificarContinuidad(
  matriz: Map<UserRole, ReadonlySet<Permission>>,
  cambios: Array<{ role: UserRole; permission: string; granted: boolean }>
) {
  const tocaLlave = cambios.some((cambio) => cambio.permission === "roles.manage");
  if (!tocaLlave) return null;

  const rolesConLlave = (Object.values(UserRole) as UserRole[]).filter((role) => {
    const cambio = cambios.find((c) => c.role === role && c.permission === "roles.manage");
    if (cambio) return cambio.granted;
    return matriz.get(role)?.has("roles.manage") ?? false;
  });

  const conLlave = rolesConLlave.length
    ? await prisma.user.count({ where: { role: { in: rolesConLlave }, status: "ACTIVE" } })
    : 0;

  if (conLlave === 0) {
    return NextResponse.json(
      {
        error:
          "Con este cambio no quedaría ninguna cuenta activa que pueda administrar permisos, " +
          "y esta pantalla dejaría de abrirse para todos. Dejá el permiso «Administrar roles y " +
          "permisos» en un rol que tenga al menos un usuario activo."
      },
      { status: 409 }
    );
  }

  return null;
}
