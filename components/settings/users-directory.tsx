"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  History,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRoundCog,
  UserRoundX,
  Eye
} from "lucide-react";
import type { UserRole, UserStatus } from "@prisma/client";
import { RoleBadge, StatusBadge } from "@/components/settings/badges";
import { formatDate, formatDateTime } from "@/components/settings/format";
import { SettingsModal } from "@/components/settings/modal";
import type { CatalogArea, UserListItem, UserListResult } from "@/lib/settings/users";
import { ROLE_ORDER, fullName, initials, roleDescriptions, roleLabels, statusLabels } from "@/lib/settings/shared";

type Filters = {
  search: string;
  role: UserRole | "";
  status: UserStatus | "";
  areaId: string;
  page: number;
};

const INITIAL_FILTERS: Filters = { search: "", role: "", status: "", areaId: "", page: 1 };

type ModalState =
  | { kind: "change-role"; user: UserListItem }
  | { kind: "status"; user: UserListItem; action: "suspend" | "reactivate" | "revoke" }
  | { kind: "edit"; user: UserListItem }
  | null;

export function UsersDirectory({
  initialData,
  catalog,
  sessionUserId
}: {
  initialData: UserListResult;
  catalog: CatalogArea[];
  sessionUserId: string;
}) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [data, setData] = useState<UserListResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const skipFirstFetch = useRef(true);

  const fetchUsers = useCallback(async (activeFilters: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: "users", page: String(activeFilters.page) });
      if (activeFilters.search) params.set("search", activeFilters.search);
      if (activeFilters.role) params.set("role", activeFilters.role);
      if (activeFilters.status) params.set("status", activeFilters.status);
      if (activeFilters.areaId) params.set("areaId", activeFilters.areaId);
      const response = await fetch(`/api/settings?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el listado.");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el listado.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Búsqueda con debounce; los selects y la paginación disparan al instante
  // porque pasan por el mismo estado.
  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    const handle = window.setTimeout(() => fetchUsers(filters), 280);
    return () => window.clearTimeout(handle);
  }, [filters, fetchUsers]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  function updateFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  }

  async function runAction(userId: string, body: Record<string, unknown>, successMessage: string) {
    const response = await fetch(`/api/settings?action=user&id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo completar la operación.");
    }
    setModal(null);
    setToast(successMessage);
    await fetchUsers(filters);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasActiveFilters = Boolean(filters.search || filters.role || filters.status || filters.areaId);

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-white/10 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar usuarios</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder="Buscar por nombre, apellido, DNI, correo, área..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 placeholder:font-normal focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:ring-sky-400/20"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Rol"
            value={filters.role}
            onChange={(value) => updateFilters({ role: value as Filters["role"] })}
            options={ROLE_ORDER.map((role) => ({ value: role, label: roleLabels[role] }))}
          />
          <FilterSelect
            label="Estado"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value as Filters["status"] })}
            options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
          />
          <FilterSelect
            label="Área"
            value={filters.areaId}
            onChange={(value) => updateFilters({ areaId: value })}
            options={catalog.map((area) => ({ value: area.id, label: area.name }))}
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => fetchUsers(filters)} className="ml-auto rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-bold transition hover:bg-rose-100 dark:border-rose-400/40 dark:hover:bg-rose-400/10">
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="urban-scrollbar overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 dark:border-white/10 dark:text-slate-500">
              <th scope="col" className="px-4 py-3">Usuario</th>
              <th scope="col" className="px-3 py-3">DNI</th>
              <th scope="col" className="px-3 py-3">Área / Dependencia</th>
              <th scope="col" className="px-3 py-3">Rol</th>
              <th scope="col" className="px-3 py-3">Estado</th>
              <th scope="col" className="px-3 py-3">Último acceso</th>
              <th scope="col" className="px-3 py-3">Alta</th>
              <th scope="col" className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
            {data.users.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {hasActiveFilters ? "Ningún usuario coincide con la búsqueda." : "Todavía no hay usuarios cargados."}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {hasActiveFilters
                      ? "Probá con otros términos o limpiá los filtros."
                      : "Las cuentas se crean desde el registro ciudadano o, próximamente, vinculando identidades de SIDITUC."}
                  </p>
                  {hasActiveFilters ? (
                    <button onClick={() => setFilters(INITIAL_FILTERS)} className="mt-4 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300">
                      Limpiar filtros
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              data.users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === sessionUserId}
                  onChangeRole={() => setModal({ kind: "change-role", user })}
                  onEdit={() => setModal({ kind: "edit", user })}
                  onStatus={(action) => setModal({ kind: "status", user, action })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-white/10">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">
          {data.total} usuario{data.total === 1 ? "" : "s"} · página {data.page} de {totalPages}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            disabled={data.page <= 1 || loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition enabled:hover:border-sky-300 enabled:hover:text-sky-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            disabled={data.page >= totalPages || loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition enabled:hover:border-sky-300 enabled:hover:text-sky-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modal?.kind === "change-role" ? (
        <ChangeRoleModal user={modal.user} onClose={() => setModal(null)} onConfirm={runAction} />
      ) : null}
      {modal?.kind === "status" ? (
        <StatusModal user={modal.user} action={modal.action} onClose={() => setModal(null)} onConfirm={runAction} />
      ) : null}
      {modal?.kind === "edit" ? (
        <EditProfileModal user={modal.user} catalog={catalog} onClose={() => setModal(null)} onConfirm={runAction} />
      ) : null}

      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="status"
            className="fixed bottom-6 right-6 z-[95] rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-card dark:border-emerald-400/40 dark:bg-[#0d1b2a] dark:text-emerald-200"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none dark:text-white"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserRow({
  user,
  isSelf,
  onChangeRole,
  onEdit,
  onStatus
}: {
  user: UserListItem;
  isSelf: boolean;
  onChangeRole: () => void;
  onEdit: () => void;
  onStatus: (action: "suspend" | "reactivate" | "revoke") => void;
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.03]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">
              {fullName(user)}
              {isSelf ? <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">Vos</span> : null}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{user.dni ?? "—"}</td>
      <td className="px-3 py-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user.area?.name ?? "—"}</p>
        {user.dependency ? <p className="text-xs text-slate-400 dark:text-slate-500">{user.dependency.name}</p> : null}
      </td>
      <td className="px-3 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-3 py-3"><StatusBadge status={user.status} /></td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDateTime(user.lastLoginAt)}</td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(user.createdAt)}</td>
      <td className="px-3 py-3 text-right">
        <RowActions user={user} isSelf={isSelf} onChangeRole={onChangeRole} onEdit={onEdit} onStatus={onStatus} />
      </td>
    </tr>
  );
}

function UserAvatar({ user }: { user: Pick<UserListItem, "name" | "lastName" | "avatarUrl"> }) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar externo de origen variable
    return <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1f89f6]/10 text-xs font-black text-[#1f89f6] dark:bg-sky-400/15 dark:text-sky-200">
      {initials(user)}
    </span>
  );
}

function RowActions({
  user,
  isSelf,
  onChangeRole,
  onEdit,
  onStatus
}: {
  user: UserListItem;
  isSelf: boolean;
  onChangeRole: () => void;
  onEdit: () => void;
  onStatus: (action: "suspend" | "reactivate" | "revoke") => void;
}) {
  // El menú se monta en un portal con posición fija: el panel de la tabla tiene
  // overflow para el scroll horizontal y un dropdown absoluto adentro queda
  // recortado por ese contenedor.
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const open = position !== null;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const MENU_MAX_HEIGHT = 280;

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = window.innerWidth - rect.right;
    // Sin lugar abajo → abre hacia arriba, anclado al borde superior del botón.
    if (rect.bottom + MENU_MAX_HEIGHT > window.innerHeight && rect.top > MENU_MAX_HEIGHT) {
      setPosition({ bottom: window.innerHeight - rect.top + 6, right });
    } else {
      setPosition({ top: rect.bottom + 6, right });
    }
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setPosition(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPosition(null);
    }
    // Con posición fija, cualquier scroll desalinearía el menú: se cierra.
    function onScroll() {
      setPosition(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const items: { label: string; icon: React.ComponentType<{ className?: string }>; onClick?: () => void; href?: string; tone?: "danger"; disabled?: boolean }[] = [
    { label: "Ver perfil", icon: Eye, href: `/admin/configuracion/usuarios/${user.id}` },
    { label: "Editar", icon: Pencil, onClick: onEdit },
    { label: "Cambiar rol", icon: UserRoundCog, onClick: onChangeRole, disabled: isSelf },
    ...(user.status === "SUSPENDED" || user.status === "REVOKED" || user.status === "INACTIVE"
      ? [{ label: "Reactivar", icon: RotateCcw, onClick: () => onStatus("reactivate"), disabled: isSelf }]
      : [{ label: "Suspender", icon: Ban, onClick: () => onStatus("suspend"), disabled: isSelf }]),
    ...(user.status !== "REVOKED"
      ? [{ label: "Eliminar acceso", icon: UserRoundX, onClick: () => onStatus("revoke"), tone: "danger" as const, disabled: isSelf }]
      : []),
    { label: "Ver historial", icon: History, href: `/admin/configuracion/usuarios/${user.id}#historial` }
  ];

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones sobre ${fullName(user)}`}
        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, bottom: position.bottom, right: position.right }}
              className="fixed z-[80] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl dark:border-white/10 dark:bg-[#0d1b2a]"
            >
              {items.map((item) => {
                const Icon = item.icon;
                const className = `flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-semibold transition ${
                  item.tone === "danger"
                    ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                } ${item.disabled ? "cursor-not-allowed opacity-40" : ""}`;
                if (item.href && !item.disabled) {
                  return (
                    <Link key={item.label} role="menuitem" href={item.href} className={className} onClick={() => setPosition(null)}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.label}
                    role="menuitem"
                    disabled={item.disabled}
                    title={item.disabled ? "No podés modificar tu propia cuenta" : undefined}
                    onClick={() => {
                      setPosition(null);
                      item.onClick?.();
                    }}
                    className={className}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

type RunAction = (userId: string, body: Record<string, unknown>, successMessage: string) => Promise<void>;

function useModalSubmit(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación.");
      setBusy(false);
    }
  }

  return { busy, error, submit };
}

function AuditNotice() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      Esta acción quedará registrada en la auditoría con tu usuario, fecha, hora, IP y dispositivo.
    </p>
  );
}

function ModalFooter({ busy, confirmLabel, danger, onClose }: { busy: boolean; confirmLabel: string; danger?: boolean; onClose: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-[0.97] dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition active:scale-[0.97] disabled:opacity-60 ${
          danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1f89f6] shadow-[0_8px_24px_rgba(31,137,246,0.22)] hover:bg-[#087bec]"
        }`}
      >
        {busy ? "Guardando..." : confirmLabel}
      </button>
    </div>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200">
      {message}
    </p>
  );
}

function ChangeRoleModal({ user, onClose, onConfirm }: { user: UserListItem; onClose: () => void; onConfirm: RunAction }) {
  const [newRole, setNewRole] = useState<UserRole>(user.role);
  const [reason, setReason] = useState("");
  const { busy, error, submit } = useModalSubmit(() =>
    onConfirm(user.id, { action: "change-role", newRole, reason }, `Rol de ${fullName(user)} actualizado a ${roleLabels[newRole]}.`)
  );

  return (
    <SettingsModal title="Cambiar rol" description="El nuevo rol aplica en el próximo inicio de sesión del usuario." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Usuario</dt>
            <dd className="mt-0.5 font-bold text-slate-900 dark:text-white">{fullName(user)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Rol actual</dt>
            <dd className="mt-0.5"><RoleBadge role={user.role} /></dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Área</dt>
            <dd className="mt-0.5 font-semibold text-slate-600 dark:text-slate-300">{user.area?.name ?? "Sin área"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Dependencia</dt>
            <dd className="mt-0.5 font-semibold text-slate-600 dark:text-slate-300">{user.dependency?.name ?? "Sin dependencia"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha</dt>
            <dd className="mt-0.5 font-semibold text-slate-600 dark:text-slate-300">{formatDateTime(new Date())}</dd>
          </div>
        </dl>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Nuevo rol</span>
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            {ROLE_ORDER.map((role) => (
              <option key={role} value={role}>{roleLabels[role]}</option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{roleDescriptions[newRole]}</span>
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Observaciones (motivo del cambio)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={500}
            rows={3}
            placeholder="Ej.: pasa al equipo técnico de la Dirección de Planeamiento."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </label>

        <AuditNotice />
        <FieldError message={error} />
        <ModalFooter busy={busy} confirmLabel="Confirmar cambio" onClose={onClose} />
      </form>
    </SettingsModal>
  );
}

const statusModalCopy = {
  suspend: {
    title: "Suspender usuario",
    description: "La cuenta queda bloqueada temporalmente: no podrá iniciar sesión hasta que se la reactive.",
    confirm: "Suspender",
    success: (name: string) => `${name} quedó suspendido.`
  },
  reactivate: {
    title: "Reactivar usuario",
    description: "La cuenta vuelve a estar operativa con el rol que ya tenía asignado.",
    confirm: "Reactivar",
    success: (name: string) => `${name} fue reactivado.`
  },
  revoke: {
    title: "Eliminar acceso",
    description: "Revoca el acceso de forma definitiva. La cuenta y su historial se conservan para auditoría; no se borra información.",
    confirm: "Eliminar acceso",
    success: (name: string) => `Se revocó el acceso de ${name}.`
  }
} as const;

function StatusModal({
  user,
  action,
  onClose,
  onConfirm
}: {
  user: UserListItem;
  action: "suspend" | "reactivate" | "revoke";
  onClose: () => void;
  onConfirm: RunAction;
}) {
  const copy = statusModalCopy[action];
  const [reason, setReason] = useState("");
  const { busy, error, submit } = useModalSubmit(() =>
    onConfirm(user.id, { action, reason }, copy.success(fullName(user)))
  );

  return (
    <SettingsModal title={copy.title} description={copy.description} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">{fullName(user)}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
          <span className="ml-auto"><StatusBadge status={user.status} /></span>
        </div>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={500}
            rows={3}
            placeholder="El motivo queda asentado en la auditoría."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </label>

        <AuditNotice />
        <FieldError message={error} />
        <ModalFooter busy={busy} confirmLabel={copy.confirm} danger={action !== "reactivate"} onClose={onClose} />
      </form>
    </SettingsModal>
  );
}

function EditProfileModal({
  user,
  catalog,
  onClose,
  onConfirm
}: {
  user: UserListItem;
  catalog: CatalogArea[];
  onClose: () => void;
  onConfirm: RunAction;
}) {
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [areaId, setAreaId] = useState(user.area?.id ?? "");
  const [dependencyId, setDependencyId] = useState(user.dependency?.id ?? "");
  const dependencies = useMemo(
    () => catalog.find((area) => area.id === areaId)?.dependencies ?? [],
    [catalog, areaId]
  );
  const { busy, error, submit } = useModalSubmit(() =>
    onConfirm(
      user.id,
      { action: "update-profile", lastName: lastName || null, areaId: areaId || null, dependencyId: dependencyId || null },
      `Perfil de ${fullName(user)} actualizado.`
    )
  );

  return (
    <SettingsModal title="Editar usuario" description="Datos administrativos de la cuenta. Los datos de identidad llegarán desde SIDITUC." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Apellido</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={80}
            placeholder="Apellido del usuario"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Área</span>
          <select
            value={areaId}
            onChange={(event) => {
              setAreaId(event.target.value);
              setDependencyId("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            <option value="">Sin área</option>
            {catalog.map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Dependencia</span>
          <select
            value={dependencyId}
            onChange={(event) => setDependencyId(event.target.value)}
            disabled={!areaId || dependencies.length === 0}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            <option value="">Sin dependencia</option>
            {dependencies.map((dependency) => (
              <option key={dependency.id} value={dependency.id}>{dependency.name}</option>
            ))}
          </select>
          {areaId && dependencies.length === 0 ? (
            <span className="mt-1 block text-xs text-slate-400">Esta área todavía no tiene dependencias cargadas.</span>
          ) : null}
        </label>

        <FieldError message={error} />
        <ModalFooter busy={busy} confirmLabel="Guardar cambios" onClose={onClose} />
      </form>
    </SettingsModal>
  );
}
