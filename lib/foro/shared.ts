import type { DebateStance, DebateStatus } from "@prisma/client";

/** Etiquetas y estilos del foro interno de debates. */

export const debateStatusLabels: Record<DebateStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado"
};

export const debateStatusBadgeClasses: Record<DebateStatus, string> = {
  OPEN: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200",
  CLOSED: "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300",
  ARCHIVED: "border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
};

export const stanceLabels: Record<DebateStance, string> = {
  FOR: "A favor",
  AGAINST: "En contra",
  NEUTRAL: "Aporte neutral"
};

/** Verde = apoyo, rosa = objeción, azul = aporte técnico neutral. Siempre con
 *  texto además del color. */
export const stanceBadgeClasses: Record<DebateStance, string> = {
  FOR: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200",
  AGAINST: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200",
  NEUTRAL: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200"
};

export const ARGUMENT_MIN_LENGTH = 20;
export const ARGUMENT_MAX_LENGTH = 2000;
