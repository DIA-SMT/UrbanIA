// pdfjs en Node espera DOMMatrix (y opcionalmente Path2D/ImageData) como
// globals, y trata de tomarlos de @napi-rs/canvas con un require interno. En
// Vercel ese require falla: el binario nativo del canvas no queda trazado
// dentro de la funcion serverless, pdfjs solo deja un warning y despues
// revienta con "DOMMatrix is not defined" al procesar cualquier PDF (visto en
// prod: subir documento, importar y adjuntos de chats, 2026-08-01).
//
// Importar el paquete desde NUESTRO codigo hace dos cosas: obliga al tracer de
// Next/Vercel a incluir el binario en la funcion, y nos deja setear los
// globals nosotros antes de cargar pdfjs, sin depender de su fallback.
//
// Sin "server-only" a proposito, igual que extract-text.ts: tambien corre en
// scripts tsx fuera de Next.

let ensured: Promise<void> | null = null;

export function ensurePdfjsNodeGlobals(): Promise<void> {
  ensured ??= (async () => {
    if (typeof globalThis.DOMMatrix !== "undefined") {
      return;
    }
    try {
      const canvas = await import("@napi-rs/canvas");
      const globals = globalThis as Record<string, unknown>;
      globals.DOMMatrix ??= canvas.DOMMatrix;
      globals.Path2D ??= canvas.Path2D;
      globals.ImageData ??= canvas.ImageData;
    } catch (error) {
      // Mismo comportamiento que el fallback de pdfjs: avisar y seguir. La
      // extraccion de texto puede sobrevivir; el render seguro no.
      console.warn("No se pudo polyfillear DOMMatrix desde @napi-rs/canvas.", error instanceof Error ? error.message : error);
    }
  })();
  return ensured;
}
