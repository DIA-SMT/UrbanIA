import { AppFeedbackKind, AppFeedbackStatus } from "@prisma/client";

/**
 * Vocabulario compartido de las recomendaciones sobre UrbanIA. Vive aparte del
 * handler porque lo usan las dos puntas: el formulario publico (cliente) y la
 * bandeja interna (server component). Sin "server-only" a proposito.
 */

/** Lo que ve el vecino. El enum de la base queda del lado del server. */
export const FEEDBACK_KINDS = ["Sugerencia", "Problema", "Experiencia"] as const;

export type FeedbackKindLabel = (typeof FEEDBACK_KINDS)[number];

export const kindToDb: Record<FeedbackKindLabel, AppFeedbackKind> = {
  Sugerencia: AppFeedbackKind.SUGGESTION,
  Problema: AppFeedbackKind.PROBLEM,
  Experiencia: AppFeedbackKind.EXPERIENCE
};

export const dbToKind: Record<AppFeedbackKind, FeedbackKindLabel> = {
  SUGGESTION: "Sugerencia",
  PROBLEM: "Problema",
  EXPERIENCE: "Experiencia"
};

/** Ayuda de cada tipo, para que el vecino elija sin tener que adivinar. */
export const KIND_HINTS: Record<FeedbackKindLabel, string> = {
  Sugerencia: "Algo que le agregarías o cambiarías al portal.",
  Problema: "Algo que no funcionó, no cargó o te dejó a mitad de camino.",
  Experiencia: "Cómo te resultó usarlo: qué te sirvió y qué te costó."
};

export const STATUS_LABELS: Record<AppFeedbackStatus, string> = {
  NEW: "Sin leer",
  REVIEWED: "Leída",
  ARCHIVED: "Archivada"
};
