/**
 * HTML → PDF en el servidor con Chromium headless: los exports dejan de
 * depender del diálogo de imprimir del navegador y bajan como .pdf binario.
 *
 * En Vercel usa el Chromium empaquetado de @sparticuz/chromium (se descomprime
 * a /tmp en el primer uso de la instancia); en desarrollo local usa el Chrome
 * instalado en la máquina. Sin "server-only" a propósito: también lo usan
 * scripts tsx de verificación.
 */

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer-core");

  const browser = process.env.VERCEL
    ? await (async () => {
        const chromium = (await import("@sparticuz/chromium")).default;
        return puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true
        });
      })()
    : await puppeteer.launch({ channel: "chrome", headless: true });

  try {
    const page = await browser.newPage();
    // El HTML es autocontenido (estilos inline, logos en data URI): "load" alcanza.
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
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
