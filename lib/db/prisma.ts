import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? { db: { url: runtimeDatabaseUrl(process.env.DATABASE_URL) } }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Tamano del pool de Prisma.
 *
 * Estaba fijo en 1 para no agotar el session pooler de Supabase, pero con una
 * sola conexion CADA `Promise.all` del proyecto corre en serie: las consultas
 * concurrentes hacen cola y se paga un round-trip a la nube atras de otro.
 * Medido contra la base real, seis consultas en paralelo tardan 340 ms con
 * limite 1, 149 ms con 5 y 112 ms con 10.
 *
 * El default sigue siendo prudente porque en serverless cada instancia abre su
 * propio pool y el total se multiplica por la cantidad de lambdas vivas.
 * DATABASE_CONNECTION_LIMIT permite ajustarlo por entorno sin tocar codigo; si
 * la URL ya trae connection_limit, gana la URL.
 */
function connectionLimit(): number {
  const configured = Number(process.env.DATABASE_CONNECTION_LIMIT);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return process.env.VERCEL ? 3 : 5;
}

function runtimeDatabaseUrl(value: string) {
  const url = new URL(value);

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(connectionLimit()));
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "15");
  }

  return url.toString();
}
