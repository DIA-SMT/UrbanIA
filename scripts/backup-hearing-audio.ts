/**
 * Copia de seguridad del audio de las audiencias, fuera de Supabase.
 *
 * El bucket es hoy la UNICA copia de la grabacion. Alcanza para no depender de
 * la computadora donde se grabo, pero no cubre que se llene la cuota, que se
 * borre la audiencia desde la app (eso borra su audio) ni un problema del
 * proyecto de Supabase. Para un registro publico conviene una copia afuera.
 *
 * Uso:
 *   npm run hearings:backup-audio                 -> a ./backups/audiencias
 *   npm run hearings:backup-audio -- D:\respaldo   -> a la carpeta que se indique
 *
 * Es idempotente: los tramos que ya estan copiados con el mismo tamano se
 * saltean, asi se puede correr seguido sin volver a bajar todo.
 */

import "./load-env";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";

/*
 * El cliente de Storage se arma aca en vez de reusar lib/storage/supabase.ts a
 * proposito: ese modulo declara "server-only" y no se puede importar desde un
 * script (tsx corre fuera de Next y el paquete ni siquiera existe en
 * node_modules). Sacarle el "server-only" seria peor: ese modulo lee la service
 * role key y el guard es lo que evita que termine en un bundle de cliente.
 * Son diez lineas duplicadas a cambio de no aflojar esa proteccion.
 */
const BUCKET = process.env.SUPABASE_HEARING_AUDIO_BUCKET ?? "audiencias-audio";

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Falta configurar Supabase (NEXT_PUBLIC_SUPABASE_URL y la key) en .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET);
}

async function downloadPart(storagePath: string): Promise<Uint8Array> {
  const { data, error } = await storage().download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el tramo");
  return new Uint8Array(await data.arrayBuffer());
}

function log(message: string) {
  console.log(`[backup-audio] ${message}`);
}

/** Nombre de carpeta legible y seguro para el sistema de archivos. */
function safeName(value: string): string {
  return value.replace(/[^\w\s.\-]/g, "_").replace(/\s+/g, " ").trim().slice(0, 60) || "audiencia";
}

async function main() {
  const target = path.resolve(process.argv[2] || path.join(process.cwd(), "backups", "audiencias"));

  const media = await prisma.meetingMedia.findMany({
    where: { kind: "AUDIO" },
    orderBy: [{ meetingId: "asc" }, { partIndex: "asc" }],
    select: {
      fileName: true,
      storagePath: true,
      sizeBytes: true,
      meeting: { select: { id: true, title: true, occurredAt: true } }
    }
  });

  if (!media.length) {
    log("No hay audio guardado todavia.");
    return;
  }

  log(`${media.length} tramos en ${new Set(media.map((m) => m.meeting.id)).size} audiencias → ${target}`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const item of media) {
    const fecha = item.meeting.occurredAt?.toISOString().slice(0, 10) ?? "sin-fecha";
    const folder = path.join(target, `${fecha} ${safeName(item.meeting.title)} (${item.meeting.id})`);
    const destination = path.join(folder, item.fileName);

    // Ya copiado y del mismo tamano: se saltea (permite correrlo seguido).
    const expected = Number(item.sizeBytes ?? 0);
    const existing = await stat(destination).catch(() => null);
    if (existing && expected > 0 && existing.size === expected) {
      skipped += 1;
      continue;
    }

    try {
      await mkdir(folder, { recursive: true });
      const data = await downloadPart(item.storagePath);
      await writeFile(destination, data);
      copied += 1;
      bytes += data.length;
      log(`✓ ${path.relative(target, destination)} (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (error) {
      failed += 1;
      log(`✗ ${item.storagePath}: ${error instanceof Error ? error.message : error}`);
    }
  }

  log(`Listo: ${copied} copiados (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} ya estaban, ${failed} fallaron.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
