/**
 * Verifica que cada clave de outputFileTracingIncludes/Excludes matchee alguna
 * ruta real, y corre como primer paso de `npm run build`.
 *
 * Por que existe: esas claves NO son rutas, son globs que Next evalua con
 * picomatch. Una clave que no matchea nada no rompe el build ni el deploy: la
 * funcion simplemente sale sin los archivos que la clave iba a agregar, y el
 * error aparece meses despues en produccion, en runtime, disfrazado de otra
 * cosa. Paso exactamente eso: al fusionar /api/hearings/[id] en el catch-all
 * [[...segments]] (2026-08-13), los corchetes sin escapar dejaron de matchear y
 * el binario de Chromium nunca mas viajo a la funcion. El resumen ejecutivo en
 * PDF respondia "el servicio de exportacion no respondio" desde entonces.
 *
 * El chequeo es solo sobre las CLAVES (que ruta recibe los archivos). Los globs
 * de archivos no se validan a proposito: casi todos apuntan a binarios de Linux
 * que no existen en una maquina de desarrollo Windows o macOS.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import nextConfig from "../next.config";

// Los dos vienen del build de Next: la misma implementacion que decide, en
// serio, que clave matchea que ruta. Importarlos evita reimplementar el matcheo
// y que el chequeo diga que si mientras el build hace otra cosa.
const picomatch = require("next/dist/compiled/picomatch");
const { normalizeAppPath } = require("next/dist/shared/lib/router/utils/app-paths");

const APP_DIR = join(process.cwd(), "app");

/** Las rutas que Next va a matchear, en el mismo formato que usa el build. */
function collectRoutes(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectRoutes(full, found);
      continue;
    }
    if (entry.name === "route.ts" || entry.name === "route.tsx" || entry.name === "page.tsx") {
      const entryName = `app/${relative(APP_DIR, full).replace(/\\/g, "/").replace(/\.tsx?$/, "")}`;
      found.push(normalizeAppPath(entryName));
    }
  }
  return found;
}

function main() {
  if (!existsSync(APP_DIR)) {
    console.error("[tracing] No encuentro el directorio app/. Corriendo desde la raiz del proyecto?");
    process.exit(1);
  }

  const routes = collectRoutes(APP_DIR);
  const groups = [
    ["outputFileTracingIncludes", nextConfig.outputFileTracingIncludes],
    ["outputFileTracingExcludes", nextConfig.outputFileTracingExcludes]
  ] as const;

  const broken: string[] = [];
  for (const [name, map] of groups) {
    for (const key of Object.keys(map ?? {})) {
      const isMatch = picomatch(key, { dot: true, contains: true });
      const matched = routes.filter((route) => isMatch(route));
      if (matched.length === 0) {
        broken.push(`  ${name}["${key}"] no matchea NINGUNA ruta`);
      }
    }
  }

  if (broken.length) {
    console.error("\n[tracing] Hay claves de tracing que no le aplican a ninguna ruta:\n");
    console.error(broken.join("\n"));
    console.error(
      "\nEsas claves son globs (picomatch), no rutas. Si la ruta tiene corchetes hay que" +
        '\nescaparlos: "/api/x/\\\\[\\\\[...segments\\\\]\\\\]". Una clave que no matchea deja a la' +
        "\nfuncion sin los archivos que iba a agregar, sin aviso hasta que falla en produccion.\n"
    );
    process.exit(1);
  }

  const total = Object.keys(nextConfig.outputFileTracingIncludes ?? {}).length +
    Object.keys(nextConfig.outputFileTracingExcludes ?? {}).length;
  console.log(`[tracing] ${total} claves verificadas contra ${routes.length} rutas.`);
}

main();
