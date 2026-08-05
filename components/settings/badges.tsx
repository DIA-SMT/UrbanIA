import type { UserRole, UserStatus } from "@prisma/client";
import { roleBadgeClasses, roleLabels, statusBadgeClasses, statusLabels } from "@/lib/settings/shared";

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClasses[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${roleBadgeClasses[role]}`}>
      {roleLabels[role]}
    </span>
  );
}
