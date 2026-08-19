import "server-only";

import { AppFeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dbToKind, type FeedbackKindLabel } from "@/lib/feedback/shared";

/** Una recomendación como la ve la bandeja interna. */
export type FeedbackEntry = {
  id: string;
  kind: FeedbackKindLabel;
  text: string;
  name: string;
  /** Del User vinculado. Null si la cuenta se borró (la recomendación queda). */
  email: string | null;
  status: AppFeedbackStatus;
  createdAt: string;
};

export type FeedbackInbox = {
  entries: FeedbackEntry[];
  counts: { total: number; nuevas: number; problemas: number };
};

/**
 * Lo que los vecinos mandaron sobre la herramienta. Se lee directo con Prisma
 * desde el server component de la pantalla: no hace falta una ruta de API para
 * leer, y el proyecto está en el tope de 12 funciones serverless de Vercel.
 *
 * `status` filtra la lista; los contadores se calculan siempre sobre el total,
 * así el encabezado no cambia de números al filtrar.
 */
export async function getFeedbackInbox(status?: AppFeedbackStatus): Promise<FeedbackInbox> {
  const [entries, total, nuevas, problemas] = await Promise.all([
    prisma.appFeedback.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        kind: true,
        text: true,
        name: true,
        status: true,
        createdAt: true,
        // El correo vive en User: sin este join no hay con qué responderle.
        user: { select: { email: true } }
      }
    }),
    prisma.appFeedback.count(),
    prisma.appFeedback.count({ where: { status: AppFeedbackStatus.NEW } }),
    prisma.appFeedback.count({ where: { kind: "PROBLEM", status: AppFeedbackStatus.NEW } })
  ]);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: dbToKind[entry.kind],
      text: entry.text,
      name: entry.name,
      email: entry.user?.email ?? null,
      status: entry.status,
      createdAt: entry.createdAt.toISOString()
    })),
    counts: { total, nuevas, problemas }
  };
}
