import { NextResponse } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { getSettingsSession } from "@/lib/settings/guard";
import { handleUserAction } from "@/lib/settings/api/user-actions";
import { listCatalog, listUsers } from "@/lib/settings/users";

export const dynamic = "force-dynamic";

/*
 * Toda la API de Configuración > Usuarios y Accesos entra por esta ruta con la
 * operación en `action`, igual que audiencias y normas: cada route.ts cuenta
 * como una función serverless en Vercel y el cupo es chico.
 *
 * GET  ?action=users&search=&role=&status=&areaId=&page=  → listado paginado
 * GET  ?action=catalog                                    → áreas y dependencias
 * PATCH ?action=user&id=<userId>                          → mutaciones (rol/estado/perfil)
 */

function parseEnum<T extends Record<string, string>>(value: string | null, options: T): T[keyof T] | undefined {
  if (value && (Object.values(options) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  return undefined;
}

export async function GET(request: Request) {
  const session = await getSettingsSession("users.manage");
  if (!session) {
    return NextResponse.json({ error: "Necesitás permisos de administración de usuarios." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "users";

  try {
    if (action === "catalog") {
      return NextResponse.json({ areas: await listCatalog() });
    }

    if (action === "users") {
      const result = await listUsers({
        search: searchParams.get("search") ?? undefined,
        role: parseEnum(searchParams.get("role"), UserRole),
        status: parseEnum(searchParams.get("status"), UserStatus),
        areaId: searchParams.get("areaId") ?? undefined,
        page: Number(searchParams.get("page")) || 1
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Fallo la API de configuración", error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") !== "user") {
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  }
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id del usuario." }, { status: 400 });
  }

  try {
    return await handleUserAction(request, id);
  } catch (error) {
    console.error("Fallo la mutación de usuario", error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
