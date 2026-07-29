import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { CPU_LAMINAS } from "../lib/normative/laminas";

/**
 * Genera las laminas del CPU vigente: las paginas del PDF original que tienen
 * tablas, croquis o planos, renderizadas a imagen en public/normativa/cpu-2014.
 *
 * El import estructurado del codigo (data/codigo-planeamiento-2014.txt) es
 * texto plano: aplasta las tablas y pierde los graficos. Estas laminas son la
 * unica forma fiel de mostrarlos, y las consume el documento comparado de la
 * Fabrica de Normas.
 *
 * Correr una vez (o tras cambiar el PDF fuente):
 *   npx tsx scripts/generate-cpu-laminas.ts
 *
 * Los croquis y tablas (vectoriales) salen en PNG nitido a 2x; los planos de
 * zonificacion (escaneados) en JPEG para no inflar el repo.
 */

const PDF_PATH = join(process.cwd(), "data", "sources", "TEXTO CPU 2014-para web.pdf");
const OUT_DIR = join(process.cwd(), "public", "normativa", "cpu-2014");

async function main() {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(PDF_PATH));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  await mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  for (const lamina of CPU_LAMINAS) {
    const page = await pdf.getPage(lamina.page);
    const scale = lamina.kind === "plano" ? 1.6 : 2.0;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvas: canvas as any, viewport }).promise;
    const buffer =
      lamina.kind === "plano" ? canvas.toBuffer("image/jpeg", 82) : canvas.toBuffer("image/png");
    const out = join(OUT_DIR, lamina.file);
    await writeFile(out, buffer);
    total += buffer.length;
    console.log(`${lamina.file.padEnd(14)} p${String(lamina.page).padStart(2)}  ${(buffer.length / 1024).toFixed(0)} KB  ${lamina.caption}`);
  }
  console.log(`\ntotal: ${(total / (1024 * 1024)).toFixed(1)} MB en ${CPU_LAMINAS.length} laminas`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
