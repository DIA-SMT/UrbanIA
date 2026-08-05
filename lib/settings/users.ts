import "server-only";

import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Datos del módulo Usuarios y Accesos. Solo lecturas; las mutaciones viven
 *  en lib/settings/api/user-actions.ts porque además escriben auditoría. */

export const USERS_PAGE_SIZE = 10;

export type UserListFilters = {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  areaId?: string;
  page?: number;
};

export type UserListItem = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  dni: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  siditucId: string | null;
  area: { id: string; name: string } | null;
  dependency: { id: string; name: string } | null;
};

export type UserListResult = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listUsers(filters: UserListFilters): Promise<UserListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const search = filters.search?.trim();

  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.areaId ? { areaId: filters.areaId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { dni: { contains: search } },
            { area: { name: { contains: search, mode: "insensitive" } } },
            { dependency: { name: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        dni: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        siditucId: true,
        area: { select: { id: true, name: true } },
        dependency: { select: { id: true, name: true } }
      }
    })
  ]);

  return {
    users: users.map((user) => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString()
    })),
    total,
    page,
    pageSize: USERS_PAGE_SIZE
  };
}

export type CatalogArea = { id: string; name: string; dependencies: { id: string; name: string }[] };

export async function listCatalog(): Promise<CatalogArea[]> {
  const areas = await prisma.area.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      dependencies: { orderBy: { name: "asc" }, select: { id: true, name: true } }
    }
  });
  return areas;
}

export async function getUserProfile(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      area: { select: { id: true, name: true } },
      dependency: { select: { id: true, name: true } },
      _count: { select: { proposals: true, projects: true, comments: true, contributions: true } }
    }
  });

  if (!user) return null;

  const [auditEntries, recentProposals, recentProjects] = await Promise.all([
    prisma.userAuditLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, lastName: true } } }
    }),
    prisma.proposal.findMany({
      where: { createdById: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true }
    }),
    prisma.project.findMany({
      where: { createdById: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true }
    })
  ]);

  return { user, auditEntries, recentProposals, recentProjects };
}

export type AuditListFilters = {
  action?: string;
  page?: number;
};

export const AUDIT_PAGE_SIZE = 20;

export async function listAuditEntries(filters: AuditListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.UserAuditLogWhereInput = filters.action ? { action: filters.action } : {};

  const [total, entries] = await Promise.all([
    prisma.userAuditLog.count({ where }),
    prisma.userAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: {
        actor: { select: { id: true, name: true, lastName: true } },
        targetUser: { select: { id: true, name: true, lastName: true } }
      }
    })
  ]);

  return { entries, total, page, pageSize: AUDIT_PAGE_SIZE };
}
