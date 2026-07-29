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
 * Estaba fijo en 1 para no agotar el pooler de Supabase, pero con una sola
 * conexion CADA `Promise.all` del proyecto corre en serie: las consultas
 * concurrentes hacen cola y se paga un round-trip a la nube atras de otro.
 * Medido contra la base real, seis consultas en paralelo tardan 340 ms con
 * limite 1, 149 ms con 5 y 112 ms con 10.
 *
 * En serverless cada instancia abre su propio pool y el total se multiplica por
 * la cantidad de lambdas vivas. Eso es tolerable SOLO contra el pooler en modo
 * transaccion (puerto 6543), que multiplexa: esas conexiones son de cliente y
 * no reservan una conexion real de Postgres cada una. Contra el modo sesion
 * (5432) el tope son 15 en total y produccion se cae con EMAXCONNSESSION —fue
 * exactamente lo que paso—, asi que ahi este numero tendria que ser 1.
 *
 * DATABASE_CONNECTION_LIMIT permite ajustarlo por entorno sin tocar codigo; si
 * la URL ya trae connection_limit, gana la URL.
 */
function connectionLimit(): number {
  const configured = Number(process.env.DATABASE_CONNECTION_LIMIT);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return process.env.VERCEL ? 3 : 5;
}

function runtimeDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Este `new URL` corre al IMPORTAR el modulo, no al consultar. Con un
    // DATABASE_URL mal pegado (las comillas de .env.local incluidas, un espacio
    // al final) el build moria con un `TypeError: Invalid URL` seguido de
    // "Failed to collect page data for /api/assistant" —la primera ruta que
    // importa prisma, alfabeticamente— sin nombrar jamas la variable. Se pierde
    // media hora buscando en el lugar equivocado; paso.
    // Los espacios y saltos de linea al principio o al final NO son la causa:
    // el parser de URL los descarta. Lo que rompe es que la cadena no empiece
    // exactamente en el esquema, que es justo lo que pasa al copiar de mas.
    throw new Error(
      'DATABASE_URL no es una URL valida: tiene que empezar exactamente en "postgresql://". ' +
        'Suele ser que se copio de mas desde .env.local y quedo adentro del valor el nombre de la ' +
        'variable ("DATABASE_URL=postgresql://...") o las comillas que la envuelven. Revisala en las ' +
        "variables de entorno del deploy."
    );
  }

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(connectionLimit()));
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "15");
  }

  return url.toString();
}
