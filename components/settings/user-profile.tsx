"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, FileText, FolderKanban, HandHeart, MessageSquare, ScrollText } from "lucide-react";
import type { UserRole, UserStatus } from "@prisma/client";
import { RoleBadge, StatusBadge } from "@/components/settings/badges";
import { formatDate, formatDateTime } from "@/components/settings/format";
import { auditActionLabel } from "@/lib/settings/audit";
import { PERMISSION_CATALOG, permissionsForRole } from "@/lib/auth/permissions";
import { fullName, initials, roleDescriptions, roleLabels } from "@/lib/settings/shared";

export type ProfileAuditEntry = {
  id: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actorName: string | null;
};

export type ProfileActivityItem = { id: string; title: string; status: string; createdAt: string };

export type ProfileData = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  dni: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  occupation: string | null;
  birthDate: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  siditucId: string | null;
  siditucVerifiedAt: string | null;
  areaName: string | null;
  dependencyName: string | null;
  counts: { proposals: number; projects: number; comments: number; contributions: number };
  auditEntries: ProfileAuditEntry[];
  recentProposals: ProfileActivityItem[];
  recentProjects: ProfileActivityItem[];
};

const TABS = [
  { id: "informacion", label: "Información" },
  { id: "roles", label: "Roles y permisos" },
  { id: "historial", label: "Historial" },
  { id: "actividad", label: "Actividad" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function UserProfile({ profile }: { profile: ProfileData }) {
  const [tab, setTab] = useState<TabId>("informacion");

  // "Ver historial" desde la tabla llega con #historial.
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (TABS.some((candidate) => candidate.id === fromHash)) setTab(fromHash as TabId);
  }, []);

  return (
    <div>
      <Link
        href="/admin/configuracion/usuarios"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Usuarios
      </Link>

      <section className="surface-panel mt-3 p-5">
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo de origen variable
            <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <span aria-hidden className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1f89f6]/10 text-xl font-black text-[#1f89f6] dark:bg-sky-400/15 dark:text-sky-200">
              {initials(profile)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">{fullName(profile)}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={profile.role} />
            <StatusBadge status={profile.status} />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4 text-sm sm:grid-cols-4 dark:border-white/10">
          <MetaItem label="Área" value={profile.areaName ?? "Sin área"} />
          <MetaItem label="Dependencia" value={profile.dependencyName ?? "Sin dependencia"} />
          <MetaItem label="Último acceso" value={formatDateTime(profile.lastLoginAt)} />
          <MetaItem label="Fecha de alta" value={formatDate(profile.createdAt)} />
        </dl>
      </section>

      <div role="tablist" aria-label="Secciones del perfil" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-white/10 dark:bg-[#0d1b2a]">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            role="tab"
            aria-selected={tab === candidate.id}
            onClick={() => setTab(candidate.id)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors duration-200 ${
              tab === candidate.id
                ? "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            }`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "informacion" ? <InfoTab profile={profile} /> : null}
        {tab === "roles" ? <RolesTab profile={profile} /> : null}
        {tab === "historial" ? <HistoryTab profile={profile} /> : null}
        {tab === "actividad" ? <ActivityTab profile={profile} /> : null}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function InfoTab({ profile }: { profile: ProfileData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface-panel p-5">
        <h3 className="text-sm font-black text-slate-950 dark:text-white">Información personal</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <InfoRow label="Nombre" value={profile.name} />
          <InfoRow label="Apellido" value={profile.lastName ?? "—"} />
          <InfoRow label="DNI" value={profile.dni ?? "—"} />
          <InfoRow label="Correo" value={profile.email} />
          <InfoRow label="Fecha de nacimiento" value={formatDate(profile.birthDate)} />
          <InfoRow label="Ocupación" value={profile.occupation ?? "—"} />
        </dl>
      </section>
      <section className="surface-panel p-5">
        <h3 className="text-sm font-black text-slate-950 dark:text-white">Información SIDITUC</h3>
        {profile.siditucId ? (
          <dl className="mt-4 space-y-3 text-sm">
            <InfoRow label="Identidad vinculada" value={profile.siditucId} />
            <InfoRow label="Verificada el" value={formatDateTime(profile.siditucVerifiedAt)} />
          </dl>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-white/15">
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Cuenta sin vincular a SIDITUC</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Cuando la integración esté activa, la identidad de esta cuenta se validará contra el padrón municipal y los datos personales llegarán como información canónica.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-white/5">
      <dt className="shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="truncate text-right font-semibold text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function RolesTab({ profile }: { profile: ProfileData }) {
  const granted = new Set(permissionsForRole(profile.role));
  const modules = Array.from(new Set(PERMISSION_CATALOG.map((permission) => permission.module)));

  return (
    <section className="surface-panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <RoleBadge role={profile.role} />
        <p className="text-sm text-slate-500 dark:text-slate-400">{roleDescriptions[profile.role]}</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <div key={module} className="rounded-xl border border-slate-200/80 p-3.5 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{module}</p>
            <ul className="mt-2 space-y-1.5">
              {PERMISSION_CATALOG.filter((permission) => permission.module === module).map((permission) => {
                const active = granted.has(permission.key);
                return (
                  <li key={permission.key} className={`flex items-center gap-2 text-sm ${active ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-400 line-through decoration-slate-300 dark:text-slate-600"}`}>
                    {active ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <CircleDashed className="h-3.5 w-3.5 shrink-0" />}
                    {permission.label}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Los permisos derivan del rol asignado ({roleLabels[profile.role]}). Los permisos personalizados por usuario llegan en la Fase 2 del módulo.
      </p>
    </section>
  );
}

function HistoryTab({ profile }: { profile: ProfileData }) {
  return (
    <section className="surface-panel p-5">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">Historial de cambios</h3>
      {profile.auditEntries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          Sin cambios registrados sobre esta cuenta. Toda modificación de rol, estado o perfil quedará asentada acá.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {profile.auditEntries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200/80 p-3.5 dark:border-white/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  <ScrollText className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {auditActionLabel(entry.action)}
                  {entry.previousValue && entry.newValue ? (
                    <span className="font-semibold text-slate-500 dark:text-slate-400"> · {entry.previousValue} → {entry.newValue}</span>
                  ) : null}
                </p>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{formatDateTime(entry.createdAt)}</p>
              </div>
              {entry.reason ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">“{entry.reason}”</p> : null}
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Por {entry.actorName ?? "el sistema"}
                {entry.ip ? ` · IP ${entry.ip}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityTab({ profile }: { profile: ProfileData }) {
  const stats = [
    { label: "Propuestas", value: profile.counts.proposals, icon: FileText },
    { label: "Proyectos", value: profile.counts.projects, icon: FolderKanban },
    { label: "Comentarios", value: profile.counts.comments, icon: MessageSquare },
    { label: "Aportes", value: profile.counts.contributions, icon: HandHeart }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="surface-panel p-4">
              <Icon className="h-4 w-4 text-[#1f89f6]" aria-hidden />
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{stat.value}</p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityList title="Últimas propuestas" items={profile.recentProposals} emptyText="Sin propuestas creadas." />
        <ActivityList title="Últimos proyectos" items={profile.recentProjects} emptyText="Sin proyectos creados." />
      </div>
    </div>
  );
}

function ActivityList({ title, items, emptyText }: { title: string; items: ProfileActivityItem[]; emptyText: string }) {
  return (
    <section className="surface-panel p-5">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-white/5">
              <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200">{item.title}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{formatDate(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
