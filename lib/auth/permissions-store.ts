import "server-only";

import { cache } from "react";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toPermissionSet, type Permission } from "@/lib/auth/permissions";

/**
 * Lectura de la matriz rol -> permiso desde la base (tabla RolePermission).
 *
 * Todo va envuelto en `cache()` de React: dentro de una misma request, resolver
 * los permisos veinte veces cuesta una sola consulta. Eso es lo que permite que
 * `hasPermission` siga siendo síncrono en sus ~77 call-sites.
 *
 * Falla CERRADA y ruidosa, distinguiendo tres situaciones que no se pueden
 * colapsar en la misma rama:
 *
 *   - devuelve filas       -> permisos del rol (CITIZEN devuelve cero, y es legítimo)
 *   - la tabla está vacía  -> matriz borrada: cero permisos + error buscable en el log
 *   - la consulta tira     -> se propaga y la request muere con 500
 *
 * La última es la importante: un `catch` que devolviera `[]` "para que no
 * explote" convertiría cualquier hipo de la base en una denegación masiva
 * silenciosa, indistinguible de un cambio deliberado de permisos. Un fallo de
 * infraestructura tiene que verse como un fallo de infraestructura.
 *
 * No hay fallback al mapa hardcodeado: ver docs/permisos.md.
 */

const AVISO_VACIA =
  "[RBAC] La tabla RolePermission está vacía: el sistema interno queda cerrado para todos. " +
  "Recuperar corriendo prisma/migrations/20260813120000_permisos_por_rol/migration.sql en Supabase.";

/** La matriz completa, para las pantallas de Roles y Permisos. */
export const loadPermissionMatrix = cache(async (): Promise<Map<UserRole, ReadonlySet<Permission>>> => {
  const filas = await prisma.rolePermission.findMany({ select: { role: true, permission: true } });
  if (filas.length === 0) console.error(AVISO_VACIA);

  const porRol = new Map<UserRole, string[]>();
  for (const fila of filas) {
    const acumulado = porRol.get(fila.role);
    if (acumulado) acumulado.push(fila.permission);
    else porRol.set(fila.role, [fila.permission]);
  }

  const matriz = new Map<UserRole, ReadonlySet<Permission>>();
  for (const [role, claves] of porRol) matriz.set(role, toPermissionSet(claves));
  return matriz;
});

/** Los permisos de un rol. Se apoya en la matriz completa para no multiplicar consultas. */
export async function resolveRolePermissions(role: UserRole): Promise<ReadonlySet<Permission>> {
  const matriz = await loadPermissionMatrix();
  return matriz.get(role) ?? new Set<Permission>();
}
