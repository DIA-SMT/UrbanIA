/**
 * HTML → PDF en el servidor con Chromium headless: los exports dejan de
 * depender del diálogo de imprimir del navegador y bajan como .pdf binario.
 *
 * En Vercel usa el Chromium empaquetado de @sparticuz/chromium (se descomprime
 * a /tmp en el primer uso de la instancia); en desarrollo local usa el Chrome
 * instalado en la máquina. Sin "server-only" a propósito: también lo usan
 * scripts tsx de verificación.
 */

/**
 * El documento no entra en la caja imprimible. Es un problema de CONTENIDO, no
 * del exportador, y se distingue con su propio tipo porque quien lo recibe tiene
 * que hacer algo distinto: acortar el texto, no reintentar.
 */
export class PdfOverflowError extends Error {
  constructor(readonly detail: string) {
    super(`El documento excede el área imprimible: ${detail}`);
    this.name = "PdfOverflowError";
  }
}

/** Chromium no llegó a arrancar. Casi siempre es empaquetado, no el documento. */
export class PdfBrowserError extends Error {
  constructor(cause: unknown) {
    super(`No se pudo iniciar el exportador de PDF: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "PdfBrowserError";
    this.cause = cause;
  }
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer-core");

  let browser;
  try {
    browser = process.env.VERCEL
      ? await (async () => {
          const chromium = (await import("@sparticuz/chromium")).default;
          return puppeteer.launch({
            args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
            executablePath: await chromium.executablePath(),
            headless: "shell",
            timeout: 60_000
          });
        })()
      : await puppeteer.launch({ channel: "chrome", headless: true, timeout: 60_000 });
  } catch (error) {
    // Arrancar el navegador falla por causas de infraestructura --binario que no
    // viajó a la función, /tmp lleno, memoria-- y no por el documento. Separarlo
    // evita que un problema de despliegue se lea como un problema de contenido.
    throw new PdfBrowserError(error);
  }

  try {
    const page = await browser.newPage();
    // El HTML es autocontenido (estilos inline, logos en data URI): "load" alcanza.
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    await page.emulateMediaType("print");
    await page.evaluate(() => document.fonts.ready);

    // Los documentos institucionales usan alturas A4 fijas y overflow:hidden.
    // Sin este control, un texto más largo podría quedar recortado sin que la
    // exportación falle. Los demás PDFs no usan estas clases y siguen igual.
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".pdf-page, .cover-body, .continuation-body"))
        .map((element) => ({
          className: element.className,
          hiddenHeight: element.scrollHeight - element.clientHeight,
          hiddenWidth: element.scrollWidth - element.clientWidth
        }))
        .filter((element) => element.hiddenHeight > 1 || element.hiddenWidth > 1)
    );
    if (overflow.length) {
      throw new PdfOverflowError(JSON.stringify(overflow));
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      // El shell institucional ya reserva su propio espacio con @page.
      preferCSSPageSize: true
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
