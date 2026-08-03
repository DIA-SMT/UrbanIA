/**
 * Carga .env.local para los scripts, tolerando el BOM.
 *
 * Por que no `--env-file` de node/tsx: el archivo arranca con BOM UTF-8 y esa
 * bandera se come la PRIMERA variable del archivo (hoy NEXT_PUBLIC_SUPABASE_URL)
 * mientras carga bien todas las demas. El sintoma es enganoso: el script falla
 * con "Supabase Storage no esta configurado" teniendo el archivo correcto.
 * Next.js no esta afectado porque su dotenv ignora el BOM.
 *
 * Importar ESTE modulo antes que cualquier otro que lea process.env.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/** Carga el archivo si existe. No pisa variables ya definidas en el entorno. */
export function loadEnvFile(file = path.join(process.cwd(), ".env.local")): void {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const line of raw.replace(/^﻿/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Se sacan las comillas envolventes, como hace dotenv.
    const value = trimmed.slice(eq + 1).trim().replace(/^["'](.*)["']$/s, "$1");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();
