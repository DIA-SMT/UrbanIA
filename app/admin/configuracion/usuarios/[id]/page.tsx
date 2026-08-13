import { notFound } from "next/navigation";
import { UserProfile, type ProfileData } from "@/components/settings/user-profile";
import { requireSettingsAccess } from "@/lib/settings/guard";
import { resolveRolePermissions } from "@/lib/auth/permissions-store";
import { getUserProfile } from "@/lib/settings/users";
import { fullName } from "@/lib/settings/shared";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function UsuarioPerfilPage({ params }: PageProps) {
  await requireSettingsAccess("users.manage");
  const { id } = await params;
  const data = await getUserProfile(id);
  if (!data) notFound();

  const { user, auditEntries, recentProposals, recentProjects } = data;
  const profile: ProfileData = {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    dni: user.dni,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    occupation: user.occupation,
    birthDate: user.birthDate?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    ciditucId: user.ciditucId,
    ciditucVerifiedAt: user.ciditucVerifiedAt?.toISOString() ?? null,
    areaName: user.area?.name ?? null,
    dependencyName: user.dependency?.name ?? null,
    counts: user._count,
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      reason: entry.reason,
      ip: entry.ip,
      userAgent: entry.userAgent,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.actor ? fullName(entry.actor) : null
    })),
    recentProposals: recentProposals.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    recentProjects: recentProjects.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))
  };

  // La matriz vive en la base y este componente es cliente: los permisos del rol
  // se resuelven acá y viajan como props. Importarlos en el cliente devolvería
  // una copia congelada del código.
  const grantedPermissions = Array.from(await resolveRolePermissions(user.role));

  return <UserProfile profile={profile} grantedPermissions={grantedPermissions} />;
}
