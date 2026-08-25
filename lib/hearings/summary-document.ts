/**
 * Documento institucional para el resumen ejecutivo de una audiencia. No importa
 * módulos de servidor: recibe los logos ya embebidos y también puede renderizarse
 * desde scripts de control visual.
 *
 * El documento tiene dos mitades de distinto origen, y la diferencia importa:
 *
 *   - Lo REGISTRADO (quiénes expusieron, qué propuso cada una, qué artículos del
 *     Código se tocan) sale del expediente: del análisis ya verificado de cada
 *     PDF presentado. No lo redacta el modelo.
 *   - Lo REDACTADO (de qué se trató, el debate de la sala, las líneas de acción,
 *     el cierre) sí lo escribe el modelo sobre ese mismo material.
 *
 * Mantenerlas separadas es lo que permite poner nombres de organizaciones y
 * citas textuales en un documento con membrete municipal.
 */

export type SummaryBlock = {
  titulo: string;
  parrafos: string[];
  destacados?: string[];
  datos?: { valor: string; descripcion: string }[];
  tabla?: { titulo?: string; columnas: string[]; filas: string[][] };
};

export type SummarySection = SummaryBlock & {
  subsecciones?: SummaryBlock[];
};

/** Un artículo del Código alcanzado por una propuesta. */
export type SummaryArticleRef = {
  numero: string;
  /** Qué regula el artículo, para no mostrar un número pelado. */
  titulo: string;
  /** "Modifica", "Deroga", "Posible conflicto con"… ya traducido. */
  relacion: string;
  porQue: string;
};

/** Quién expuso y qué trajo. */
export type SummaryPresenter = {
  organizacion: string;
  documento: string;
  /** Qué es el documento, en 2-4 oraciones. */
  queTrajo: string;
  /** PROPUESTA_NORMATIVA, DIAGNOSTICO_TECNICO… ya traducido, o null. */
  tipo: string | null;
  propuestas: number;
};

/** Una propuesta concreta, con la cita del PDF que la respalda. */
export type SummaryProposal = {
  organizacion: string;
  documento: string;
  titulo: string;
  resumen: string;
  cita: string;
  paginas: number[];
  articulos: SummaryArticleRef[];
};

/** Un artículo del Código y las propuestas que lo tocan. */
export type SummaryArticleImpact = {
  numero: string;
  titulo: string;
  propuestas: Array<{ organizacion: string; titulo: string; relacion: string }>;
};

/** Lo efectivamente presentado en la audiencia, ya verificado. */
export type HearingSummaryMaterial = {
  expositores: SummaryPresenter[];
  propuestas: SummaryProposal[];
  impacto: SummaryArticleImpact[];
};

export type SummaryPayload = {
  titulo: string;
  bajada: string;
  deQueSeTrata: string;
  /**
   * Quiénes expusieron. Es una lista y no un nombre suelto porque en estas
   * audiencias exponen varias organizaciones: el campo `expositor` en singular
   * obligaba a elegir una y dejar afuera al resto.
   */
  expositores: string[];
  destinatario: string;
  estructura: string;
  secciones: SummarySection[];
  lineasDeAccion: string[];
  enSintesis: string;
  /**
   * Lo registrado. Opcional: una audiencia sin documentos presentados —o el
   * script de control visual— produce el documento igual, sin estas páginas.
   */
  material?: HearingSummaryMaterial;
};

export type InstitutionalSummaryOptions = {
  hearingTitle: string;
  when: string;
  docCode: string;
  monthYear: string;
  sourceSummary: string;
  municipalHeaderLogo: string;
  municipalFooterLogo: string;
  diaLogo: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/[–—‑]/g, "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clampText(value: string, maxLength: number): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"));
  if (sentenceEnd >= Math.floor(maxLength * 0.55)) return clipped.slice(0, sentenceEnd + 1);
  const wordEnd = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(wordEnd, maxLength - 20)).trim()}...`;
}

/** Numeración de las partes del documento: 01, 02… y 10 sin cero adelante. */
function sectionNumber(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function firstSentence(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return clampText(match?.[0] ?? clean, 155);
}

function renderLogo(src: string | null | undefined, className: string, alt: string): string {
  return src ? `<img class="${className}" src="${src}" alt="${escapeHtml(alt)}">` : "";
}

function renderSectionHeading(title: string, kicker?: string): string {
  return [
    `<div class="section-heading">`,
    kicker ? `<span>${escapeHtml(kicker)}</span>` : "",
    `<h2>${escapeHtml(title)}</h2>`,
    `</div>`
  ].join("");
}

function renderFooter(page: number, total: number, options: InstitutionalSummaryOptions): string {
  const municipal = [
    `<div class="footer-brand footer-municipal">`,
    renderLogo(options.municipalFooterLogo, "footer-municipal-logo", "Municipalidad de San Miguel de Tucumán"),
    `<div><strong>Municipalidad de San Miguel de Tucumán</strong><small>UrbanIA | Audiencias públicas</small></div>`,
    `</div>`
  ].join("");
  const dia = [
    `<div class="footer-brand footer-dia">`,
    renderLogo(options.diaLogo, "footer-dia-logo", "Dirección de Inteligencia Artificial"),
    `<div><strong>Dirección de Inteligencia Artificial</strong><small>Área desarrolladora</small></div>`,
    `</div>`
  ].join("");
  const municipalAttribution = `Municipalidad SMT | ${escapeHtml(options.monthYear)} | Página ${page} de ${total}`;
  const diaAttribution = `Desarrollado por Dirección de IA | ${escapeHtml(options.monthYear)} | Página ${page} de ${total}`;
  const odd = page % 2 === 1;

  return [
    `<footer class="institutional-footer">`,
    odd ? municipal : dia,
    `<div class="footer-attribution">${odd ? diaAttribution : municipalAttribution}<small>${escapeHtml(options.docCode)} | Documento de trabajo</small></div>`,
    `</footer>`
  ].join("");
}

function renderContinuationHeader(title: string, options: InstitutionalSummaryOptions): string {
  return [
    `<header class="continuation-header">`,
    `<div class="continuation-title"><span>${escapeHtml(title)}</span>${renderLogo(
      options.municipalHeaderLogo,
      "continuation-logo",
      "Ciudad de San Miguel de Tucumán"
    )}</div>`,
    `<div class="institutional-rule"><i></i><b></b></div>`,
    `</header>`
  ].join("");
}

function renderDataCards(data?: { valor: string; descripcion: string }[]): string {
  if (!data?.length) return "";
  return `<div class="summary-data">${data
    .slice(0, 2)
    .map(
      (item) =>
        `<div class="summary-data-card"><strong>${escapeHtml(item.valor)}</strong><span>${escapeHtml(clampText(item.descripcion, 120))}</span></div>`
    )
    .join("")}</div>`;
}

function renderSummarySection(section: SummarySection, numero: number): string {
  /*
   * Hasta 4 parrafos de 800 caracteres, contra los 2 de 560 de antes.
   *
   * Esos topes eran el tercer recorte encadenado del resumen, y el mas dificil
   * de ver: el modelo escribia 2.400 caracteres por seccion y al papel llegaban
   * 1.120. La mitad del texto se descartaba DESPUES de haberlo pagado, sin
   * ningun aviso.
   *
   * 4 x 800 = 3.200 como maximo. Una pagina de continuacion tiene 235 mm utiles
   * a 10,2 pt con interlineado 1,55, o sea unas 42 lineas de ~103 caracteres:
   * cerca de 4.300, menos el titulo, los margenes entre parrafos y los bloques
   * de destacados y datos. El guard de exportacion queda igual como red.
   */
  const paragraphs = section.parrafos
    .slice(0, 4)
    .map((paragraph) => `<p>${escapeHtml(clampText(paragraph, 800))}</p>`)
    .join("");
  const highlight = section.destacados?.[0]
    ? `<blockquote>${escapeHtml(clampText(section.destacados[0], 240))}</blockquote>`
    : "";

  return [
    `<section class="summary-section">`,
    renderSectionHeading(section.titulo, sectionNumber(numero)),
    paragraphs,
    renderDataCards(section.datos),
    highlight,
    `</section>`
  ].join("");
}

/** "Expositores" de la portada: dos nombres y el resto contados. */
function presentersLabel(expositores: string[]): { valor: string; detalle: string } {
  if (!expositores.length) return { valor: "No identificado en el material", detalle: "Identificación según el material" };
  if (expositores.length === 1) return { valor: expositores[0], detalle: "Única organización expositora" };
  const visibles = expositores.slice(0, 2).join(" · ");
  const resto = expositores.length - 2;
  return {
    valor: resto > 0 ? `${visibles} +${resto}` : visibles,
    detalle: `${expositores.length} organizaciones expusieron`
  };
}

function renderPageOne(
  payload: SummaryPayload,
  options: InstitutionalSummaryOptions,
  contenidos: Array<{ titulo: string; detalle: string }>,
  total: number
): string {
  const titleLength = Array.from(payload.titulo.trim()).length;
  const titleClass = titleLength > 72 ? " title-long" : titleLength > 52 ? " title-medium" : "";
  const contentCards = contenidos
    .slice(0, 4)
    .map((parte, index) =>
      [
        `<article class="content-card accent-${index + 1}">`,
        `<span>${sectionNumber(index + 1)}</span>`,
        `<div><h3>${escapeHtml(parte.titulo)}</h3><p>${escapeHtml(clampText(parte.detalle, 155))}</p></div>`,
        `</article>`
      ].join("")
    )
    .join("");

  // El paso 2 nombra explícitamente que lo presentado NO lo redacta la IA. Es la
  // diferencia que habilita a poner nombres de organizaciones y citas textuales
  // en un documento con membrete municipal, y el lector tiene derecho a saberla.
  const steps = [
    ["1", "Fuentes", "Reúne la transcripción y los documentos presentados en la audiencia."],
    ["2", "Registro", "Quiénes expusieron, sus propuestas y los artículos que tocan salen del expediente."],
    ["3", "Síntesis", "La IA redacta el debate y las prioridades sobre ese material."],
    ["4", "Validación", "El equipo municipal revisa el borrador antes de circularlo."]
  ];

  const expositores = presentersLabel(payload.expositores);

  return [
    `<section class="pdf-page cover-page">`,
    `<header class="cover-header">`,
    `<div class="cover-topline">`,
    renderLogo(options.municipalHeaderLogo, "cover-municipal-logo", "Ciudad de San Miguel de Tucumán"),
    `<div class="dia-pill">${renderLogo(options.diaLogo, "dia-pill-logo", "Dirección de Inteligencia Artificial")}<small>DESARROLLO</small></div>`,
    `</div>`,
    `<div class="cover-title${titleClass}">`,
    `<h1>${escapeHtml(payload.titulo)}</h1>`,
    `<p>${escapeHtml(clampText(payload.bajada, 210))}</p>`,
    `</div>`,
    `<div class="institutional-rule"><i></i><b></b></div>`,
    `</header>`,
    `<main class="cover-body">`,
    `<section class="about-section">`,
    renderSectionHeading("De qué se trata"),
    `<p>${escapeHtml(clampText(payload.deQueSeTrata, 720))}</p>`,
    `<div class="context-grid">`,
    `<div><span>Audiencia</span><strong>${escapeHtml(clampText(options.hearingTitle, 80))}</strong><small>${escapeHtml(options.when)}</small></div>`,
    `<div><span>Expositores</span><strong>${escapeHtml(clampText(expositores.valor, 80))}</strong><small>${escapeHtml(expositores.detalle)}</small></div>`,
    `<div><span>Destinatario</span><strong>${escapeHtml(clampText(payload.destinatario, 80))}</strong><small>Ámbito de decisión</small></div>`,
    `</div>`,
    `</section>`,
    `<section class="process-section">`,
    renderSectionHeading("Cómo funciona este resumen"),
    `<div class="process-flow">${steps
      .map(
        ([number, title, detail]) =>
          `<article><i>${number}</i><div><strong>${title}</strong><p>${detail}</p></div></article>`
      )
      .join("")}</div>`,
    `</section>`,
    `<section class="contents-section">`,
    renderSectionHeading("Qué contiene"),
    `<div class="content-grid">${contentCards}</div>`,
    `</section>`,
    `</main>`,
    renderFooter(1, total, options),
    `</section>`
  ].join("");
}

/** Una página de cuerpo: encabezado de continuación + contenido + pie. */
function renderBodyPage(
  title: string,
  body: string,
  options: InstitutionalSummaryOptions,
  page: number,
  total: number
): string {
  return [
    `<section class="pdf-page continuation-page page-${page}">`,
    renderContinuationHeader(title, options),
    `<main class="continuation-body">${body}</main>`,
    renderFooter(page, total, options),
    `</section>`
  ].join("");
}

/**
 * Reparte una lista en páginas según cuánto ocupa cada elemento.
 *
 * Las páginas tienen alto fijo y `overflow: hidden`, y el exportador aborta si
 * algo se sale (PdfOverflowError). Con contenido de largo variable --una
 * organización puede traer una propuesta y otra ocho-- no alcanza con un número
 * fijo de elementos por página: se estima el alto de cada uno en milímetros y se
 * corta cuando se acaba el papel. Un elemento que por sí solo excede el
 * presupuesto igual entra en su página, solo; para eso está el clamp de cada
 * campo, que acota cuánto puede crecer.
 *
 * El reparto es PAREJO y no goloso. Con el tope duro a secas, la última página
 * se quedaba con lo que sobró: en la prueba de control, una tabla de catorce
 * filas daba una página al 99% y otra con una fila suelta, que se lee como un
 * error de armado. Se calcula primero cuántas páginas hacen falta y después se
 * reparte el total entre ellas.
 */
function paginate<T>(items: T[], presupuesto: number, alto: (item: T) => number): T[][] {
  const costos = items.map(alto);
  const total = costos.reduce((suma, costo) => suma + costo, 0);
  const necesarias = Math.max(1, Math.ceil(total / presupuesto));
  const objetivo = total / necesarias;

  const paginas: T[][] = [];
  let actual: T[] = [];
  let usado = 0;
  for (let indice = 0; indice < items.length; indice += 1) {
    const costo = costos[indice];
    // Mientras queden páginas por abrir se reparte contra el objetivo, pero
    // midiendo el elemento por su MITAD: cortar apenas el objetivo se pasa
    // desperdicia casi un elemento por página y termina necesitando más páginas
    // que las calculadas, con lo cual el desbalance vuelve por otro lado.
    const repartiendo = paginas.length + 1 < necesarias;
    const cierra = usado + costo > presupuesto || (repartiendo && usado + costo / 2 > objetivo);
    if (actual.length && cierra) {
      paginas.push(actual);
      actual = [];
      usado = 0;
    }
    actual.push(items[indice]);
    usado += costo;
  }
  if (actual.length) paginas.push(actual);
  return paginas;
}

/*
 * Alto útil del cuerpo de una página de continuación y lo que se lleva su
 * encabezado (título de sección + párrafo de entrada). Medidos con
 * `npm run pdf:sample:audiencia`, que renderiza el peor caso realista y hace
 * pasar el guard de desborde del exportador.
 */
const CUERPO_MM = 235;
const ENCABEZADO_MM = 26;
/*
 * El aire entre dos secciones registradas que comparten hoja: 7 mm de margen y
 * 6 mm de espacio sobre la línea divisoria. Sin contarlo, dos secciones que
 * "entraban" por 10 mm se pasaban de la caja imprimible y el exportador abortaba
 * el resumen entero (pasó con la 2ª y la 6ª audiencia).
 */
const SEPARADOR_MM = 13;

function renderRecordHeading(titulo: string, numero: number, intro: string, continuacion: boolean): string {
  return [
    renderSectionHeading(continuacion ? `${titulo} (continúa)` : titulo, sectionNumber(numero)),
    intro && !continuacion ? `<p class="section-intro">${escapeHtml(intro)}</p>` : ""
  ].join("");
}

/**
 * True si el nombre de quien expuso salió del nombre del archivo.
 *
 * Cuando el análisis no identificó la organización se cae al nombre del archivo,
 * que al menos dice de qué documento se trata. Pero entonces el encabezado y la
 * referencia al archivo dicen lo mismo dos veces, y peor: un nombre de archivo
 * puesto donde va una institución se lee como si fuera una institución. Cuando
 * pasa, se aclara.
 */
function nombreDeArchivo(organizacion: string, documento: string): boolean {
  const limpio = (value: string) => value.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-\s]+/g, " ").trim().toLowerCase();
  return limpio(organizacion) === limpio(documento);
}

/** 03 · Quiénes expusieron: una tarjeta por organización. */
function renderPresentersBody(presenters: SummaryPresenter[], numero: number, continuacion: boolean, intro: string): string {
  const cards = presenters
    .map((presenter) => {
      const anonima = nombreDeArchivo(presenter.organizacion, presenter.documento);
      const referencia = anonima
        ? "Organización no identificada en el documento"
        : clampText(presenter.documento, 70);
      return [
        `<article class="presenter-card">`,
        `<header><h3>${escapeHtml(clampText(presenter.organizacion, 90))}</h3>`,
        presenter.propuestas
          ? `<span class="presenter-tag">${presenter.propuestas} ${presenter.propuestas === 1 ? "propuesta" : "propuestas"}</span>`
          : `<span class="presenter-tag presenter-tag-muted">Sin propuestas</span>`,
        `</header>`,
        `<small>${escapeHtml(referencia)}${presenter.tipo ? ` · ${escapeHtml(presenter.tipo)}` : ""}</small>`,
        presenter.queTrajo ? `<p>${escapeHtml(clampText(presenter.queTrajo, 380))}</p>` : "",
        `</article>`
      ].join("");
    })
    .join("");

  return [
    `<section class="record-section">`,
    renderRecordHeading("Quiénes expusieron", numero, intro, continuacion),
    `<div class="presenter-grid">${cards}</div>`,
    `</section>`
  ].join("");
}

/** 04 · Qué propuso cada una: agrupado por organización, con su cita textual. */
function renderProposalsBody(
  proposals: SummaryProposal[],
  numero: number,
  continuacion: boolean,
  intro: string
): string {
  const grupos: Array<{ organizacion: string; documento: string; items: SummaryProposal[] }> = [];
  for (const proposal of proposals) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.organizacion === proposal.organizacion) ultimo.items.push(proposal);
    else grupos.push({ organizacion: proposal.organizacion, documento: proposal.documento, items: [proposal] });
  }

  const bloques = grupos
    .map((grupo) =>
      [
        `<div class="proposal-group">`,
        `<h3 class="proposal-org">${escapeHtml(clampText(grupo.organizacion, 90))}<small>${escapeHtml(
          nombreDeArchivo(grupo.organizacion, grupo.documento)
            ? "Organización no identificada en el documento"
            : clampText(grupo.documento, 70)
        )}</small></h3>`,
        ...grupo.items.map((proposal) =>
          [
            `<article class="proposal-card">`,
            `<h4>${escapeHtml(clampText(proposal.titulo, 130))}</h4>`,
            proposal.resumen ? `<p>${escapeHtml(clampText(proposal.resumen, 400))}</p>` : "",
            proposal.cita
              ? `<blockquote>${escapeHtml(clampText(proposal.cita, 260))}${
                  proposal.paginas.length
                    ? `<cite>${proposal.paginas.length === 1 ? "Página" : "Páginas"} ${proposal.paginas.join(", ")}</cite>`
                    : ""
                }</blockquote>`
              : "",
            proposal.articulos.length
              ? `<ul class="article-chips">${proposal.articulos
                  .slice(0, 4)
                  .map(
                    (articulo) =>
                      `<li><b>${escapeHtml(articulo.relacion)}</b> art. ${escapeHtml(articulo.numero)}${
                        articulo.titulo ? ` — ${escapeHtml(clampText(articulo.titulo, 60))}` : ""
                      }</li>`
                  )
                  .join("")}</ul>`
              : `<p class="article-chips-empty">No modifica ningún artículo vigente: propone regular algo que el Código no contempla.</p>`,
            `</article>`
          ].join("")
        ),
        `</div>`
      ].join("")
    )
    .join("");

  return [
    `<section class="record-section">`,
    renderRecordHeading("Qué propuso cada una", numero, intro, continuacion),
    bloques,
    `</section>`
  ].join("");
}

/** 05 · Qué artículos del Código se tocan: la vista agregada. */
function renderImpactBody(
  impacto: SummaryArticleImpact[],
  numero: number,
  continuacion: boolean,
  intro: string
): string {
  const filas = impacto
    .map((articulo) => {
      const organizaciones = [...new Set(articulo.propuestas.map((proposal) => proposal.organizacion))];
      const relaciones = [...new Set(articulo.propuestas.map((proposal) => proposal.relacion))];
      return [
        `<tr>`,
        `<td class="impact-number">Art. ${escapeHtml(articulo.numero)}</td>`,
        `<td>${escapeHtml(clampText(articulo.titulo || "Sin título en el Código", 110))}</td>`,
        `<td class="impact-count">${articulo.propuestas.length}</td>`,
        `<td>${escapeHtml(clampText(organizaciones.join(" · "), 150))}<small>${escapeHtml(relaciones.join(" · "))}</small></td>`,
        `</tr>`
      ].join("");
    })
    .join("");

  return [
    `<section class="record-section">`,
    renderRecordHeading("Qué artículos del Código se tocan", numero, intro, continuacion),
    `<table class="impact-table">`,
    `<thead><tr><th>Artículo</th><th>Qué regula hoy</th><th>Propuestas</th><th>Quiénes lo tocan</th></tr></thead>`,
    `<tbody>${filas}</tbody>`,
    `</table>`,
    `</section>`
  ].join("");
}

function renderClosingPage(
  payload: SummaryPayload,
  options: InstitutionalSummaryOptions,
  page: number,
  total: number
): string {
  const actions = payload.lineasDeAccion
    .slice(0, 5)
    .map((action, index) => `<li><i>${index + 1}</i><p>${escapeHtml(clampText(action, 260))}</p></li>`)
    .join("");

  return [
    `<section class="pdf-page continuation-page closing-page">`,
    renderContinuationHeader("Prioridades y cierre", options),
    `<main class="continuation-body closing-body">`,
    `<section>`,
    renderSectionHeading("Líneas de acción", "AGENDA"),
    `<p class="section-intro">Medidas y decisiones que surgen del material analizado. Su implementación y alcance deben ser validados por las áreas municipales competentes.</p>`,
    `<ol class="action-list">${actions}</ol>`,
    `</section>`,
    `<section class="traceability-card">`,
    `<div><span>Origen</span><strong>${escapeHtml(clampText(options.hearingTitle, 95))}</strong></div>`,
    `<div><span>Fuentes analizadas</span><strong>${escapeHtml(clampText(options.sourceSummary, 180))}</strong></div>`,
    `<div><span>Carácter</span><strong>Borrador sujeto a revisión municipal</strong></div>`,
    `</section>`,
    `<section class="synthesis-block">`,
    `<span>En síntesis</span>`,
    `<p>${escapeHtml(clampText(payload.enSintesis, 620))}</p>`,
    `<small>La IA orienta; el equipo municipal revisa, redacta y valida.</small>`,
    `</section>`,
    `</main>`,
    // El número de página venía fijo en 4, de cuando el documento tenía cuatro
    // páginas siempre. Con paginación dinámica, la última página decía "4 de 9".
    renderFooter(page, total, options),
    `</section>`
  ].join("");
}

export const INSTITUTIONAL_SUMMARY_STYLES = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #33414f; }
  .pdf-document { width: 210mm; margin: 0 auto; }
  .pdf-page {
    position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #ffffff;
    page-break-after: always; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .pdf-page:last-child { page-break-after: auto; break-after: auto; }
  .institutional-rule { position: absolute; right: 0; bottom: 0; left: 0; display: flex; height: 2.6mm; }
  .institutional-rule i { width: 22%; background: #F2D91C; }
  .institutional-rule b { flex: 1; background: #3cb4f0; }

  .cover-header { position: relative; height: 53mm; padding: 11mm 14mm 0; color: #ffffff; background: radial-gradient(120% 150% at 88% 8%, rgba(60, 180, 240, 0.42), transparent 58%), linear-gradient(112deg, #0d3fb0 0%, #126ff5 52%, #2589ea 100%); }
  .cover-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .cover-municipal-logo { width: auto; max-width: 48mm; height: 11mm; object-fit: contain; object-position: left top; }
  .dia-pill { display: flex; min-width: 38mm; min-height: 12mm; flex-direction: column; align-items: center; justify-content: center; border-radius: 3mm; padding: 2.1mm 4mm 1.8mm; background: #ffffff; box-shadow: 0 3mm 8mm rgba(4, 26, 66, 0.26); }
  .dia-pill-logo { width: auto; max-width: 29mm; height: 6.4mm; object-fit: contain; }
  .dia-pill small { display: block; margin-top: 0.8mm; color: #8a949e; font-size: 5.2pt; line-height: 1; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .cover-title { position: absolute; right: 14mm; bottom: 5.2mm; left: 14mm; max-width: 164mm; }
  .cover-title h1 { margin: 0; color: #ffffff; font-size: 25pt; line-height: 0.96; font-weight: 800; letter-spacing: -0.55pt; }
  .cover-title.title-medium h1 { font-size: 23pt; line-height: 0.99; }
  .cover-title.title-long h1 { font-size: 20.5pt; line-height: 1.02; }
  .cover-title p { max-width: 160mm; margin: 1mm 0 0; color: #cceeff; font-size: 8.2pt; line-height: 1.18; }

  .cover-body { display: flex; height: 229mm; flex-direction: column; padding: 6.5mm 14mm 18mm; }
  .section-heading { position: relative; min-height: 8mm; margin-bottom: 2.5mm; padding-left: 4mm; }
  .section-heading::before { position: absolute; top: 0.4mm; bottom: 0.4mm; left: 0; width: 1.5mm; border-radius: 1mm; content: ""; background: linear-gradient(180deg, #126ff5, #3cb4f0); }
  .section-heading span { display: block; margin-bottom: 0.5mm; color: #2589ea; font-size: 6.6pt; font-weight: 800; letter-spacing: 1.4pt; text-transform: uppercase; }
  .section-heading h2 { margin: 0; color: #10233d; font-size: 14.5pt; line-height: 1.15; font-weight: 800; letter-spacing: -0.2pt; }
  .about-section > p { margin: 0; color: #33414f; font-size: 9.1pt; line-height: 1.48; }
  .context-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 2.5mm; margin-top: 3mm; }
  .context-grid > div { min-height: 16mm; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 2.3mm 3mm; background: #fbfcfe; }
  .context-grid span, .context-grid strong, .context-grid small { display: block; }
  .context-grid span { color: #2589ea; font-size: 6.2pt; font-weight: 800; letter-spacing: 1pt; text-transform: uppercase; }
  .context-grid strong { margin-top: 0.8mm; color: #10233d; font-size: 8pt; line-height: 1.2; font-weight: 700; }
  .context-grid small { margin-top: 0.7mm; color: #6b7885; font-size: 6.6pt; line-height: 1.25; }
  .process-section { margin-top: 6mm; }
  .process-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 0.35mm solid #d8e6fa; border-radius: 3.4mm; padding: 4mm 3mm; background: linear-gradient(180deg, #f6faff, #eef6ff); }
  .process-flow article { position: relative; min-width: 0; padding: 0 2.2mm; text-align: center; }
  .process-flow article:not(:last-child)::after { position: absolute; top: 5.8mm; right: -1.5mm; color: #b9cfe8; content: "›"; font-size: 13pt; font-weight: 400; }
  .process-flow article > i { display: grid; width: 15mm; height: 15mm; margin: 0 auto 2.2mm; place-items: center; border-radius: 50%; color: #ffffff; background: linear-gradient(140deg, #25d366, #1aa851); box-shadow: 0 2.4mm 5mm rgba(26, 168, 81, 0.3); font-size: 11pt; font-style: normal; font-weight: 800; }
  .process-flow article:nth-child(2) > i { background: linear-gradient(140deg, #126ff5, #28469f); box-shadow: 0 2.4mm 5mm rgba(18, 111, 245, 0.28); }
  .process-flow article:nth-child(3) > i { background: linear-gradient(140deg, #3cb4f0, #2589ea); box-shadow: 0 2.4mm 5mm rgba(18, 111, 245, 0.24); }
  .process-flow article:nth-child(4) > i { color: #10233d; background: linear-gradient(140deg, #F2D91C, #f5b81c); box-shadow: 0 2.4mm 5mm rgba(239, 143, 22, 0.3); }
  .process-flow strong { color: #10233d; font-size: 8.1pt; font-weight: 800; }
  .process-flow p { margin: 0.8mm auto 0; color: #6b7885; font-size: 6.8pt; line-height: 1.35; }
  .contents-section { display: flex; min-height: 0; flex: 1; flex-direction: column; margin-top: 6mm; }
  .content-grid { display: grid; min-height: 0; flex: 1; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, 1fr); gap: 2.5mm; }
  .content-card { display: grid; min-height: 25mm; grid-template-columns: 8mm 1fr; gap: 2.2mm; align-items: center; border: 0.35mm solid #e3e8ef; border-left-width: 1.5mm; border-radius: 2.6mm; padding: 3mm 3.4mm; background: #ffffff; box-shadow: 0 1.5mm 4mm rgba(16, 35, 61, 0.06); }
  .content-card > span { color: #2589ea; font-size: 7pt; font-weight: 800; }
  .content-card h3 { margin: 0; color: #10233d; font-size: 8.6pt; line-height: 1.15; font-weight: 800; }
  .content-card p { margin: 1mm 0 0; color: #6b7885; font-size: 6.8pt; line-height: 1.32; }
  .content-card.accent-1 { border-left-color: #126ff5; }
  .content-card.accent-2 { border-left-color: #3cb4f0; }
  .content-card.accent-3 { border-left-color: #10b981; }
  .content-card.accent-4 { border-left-color: #f5b81c; }

  .continuation-header { position: relative; height: 20mm; overflow: hidden; color: #ffffff; background: linear-gradient(90deg, #F2D91C 0 22%, #3cb4f0 22%) bottom / 100% 1.6mm no-repeat, linear-gradient(112deg, #0d3fb0, #126ff5 62%, #2589ea); }
  .continuation-header > .institutional-rule { display: none; }
  .continuation-title { position: absolute; top: 4mm; right: 14mm; left: 14mm; z-index: 1; display: flex; height: 9mm; align-items: center; justify-content: space-between; gap: 8mm; }
  .continuation-title span { color: #ffffff; font-size: 13pt; line-height: 1; font-weight: 800; letter-spacing: -0.1pt; }
  .continuation-logo { width: auto; max-width: 47mm; height: 7.6mm; flex: 0 0 auto; object-fit: contain; object-position: right center; }
  .continuation-body { height: 262mm; padding: 8mm 14mm 19mm; }
  .summary-section { min-height: 111mm; padding: 1mm 0 5mm; }
  .summary-section + .summary-section { border-top: 0.35mm solid #e3e8ef; padding-top: 6mm; }
  .summary-section > p { margin: 2.4mm 0 0; color: #33414f; font-size: 10.2pt; line-height: 1.55; }
  .summary-section blockquote { margin: 3.2mm 0 0; border-left: 1.5mm solid #3cb4f0; border-radius: 0 2.6mm 2.6mm 0; padding: 2.5mm 3.5mm; color: #28469f; background: #eef7ff; font-size: 9.2pt; line-height: 1.4; font-style: italic; }
  .summary-data { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5mm; margin-top: 3mm; }
  .summary-data-card { border: 0.35mm solid #dce7f3; border-radius: 2.6mm; padding: 2.6mm 3mm; background: #fbfcfe; }
  .summary-data-card strong, .summary-data-card span { display: block; }
  .summary-data-card strong { color: #126ff5; font-size: 14pt; line-height: 1; font-weight: 800; }
  .summary-data-card span { margin-top: 1mm; color: #6b7885; font-size: 7.4pt; line-height: 1.3; }

  /* Lo registrado: sale del expediente, no lo redacta el modelo. */
  .record-section { padding: 1mm 0 0; }
  .record-section + .record-section { margin-top: 7mm; border-top: 0.35mm solid #e3e8ef; padding-top: 6mm; }
  .record-section > .section-intro { max-width: 170mm; margin-bottom: 3.5mm; font-size: 8.6pt; line-height: 1.45; }

  .presenter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .presenter-card { display: flex; flex-direction: column; border: 0.35mm solid #e3e8ef; border-left: 1.5mm solid #126ff5; border-radius: 2.6mm; padding: 3mm 3.4mm; background: #fbfcfe; }
  .presenter-card header { display: flex; align-items: flex-start; justify-content: space-between; gap: 2mm; }
  .presenter-card h3 { margin: 0; color: #10233d; font-size: 8.8pt; line-height: 1.2; font-weight: 800; }
  .presenter-tag { flex: 0 0 auto; border-radius: 1.6mm; padding: 0.7mm 1.8mm; color: #126ff5; background: #e8f2ff; font-size: 6.2pt; font-weight: 800; white-space: nowrap; }
  .presenter-tag-muted { color: #6b7885; background: #eef1f5; }
  .presenter-card > small { display: block; margin-top: 1.2mm; color: #6b7885; font-size: 6.5pt; line-height: 1.3; }
  .presenter-card > p { margin: 2mm 0 0; color: #33414f; font-size: 8.1pt; line-height: 1.42; }

  .proposal-group + .proposal-group { margin-top: 4mm; }
  .proposal-org { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; margin: 0 0 2.2mm; border-bottom: 0.35mm solid #dce7f3; padding-bottom: 1.4mm; color: #0d3fb0; font-size: 9.4pt; line-height: 1.2; font-weight: 800; }
  .proposal-org small { flex: 0 1 auto; color: #9aa6b2; font-size: 6.4pt; font-weight: 600; text-align: right; }
  .proposal-card { border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 2.8mm 3.4mm; background: #ffffff; }
  .proposal-card + .proposal-card { margin-top: 2.4mm; }
  .proposal-card h4 { margin: 0; color: #10233d; font-size: 8.8pt; line-height: 1.25; font-weight: 800; }
  .proposal-card > p { margin: 1.6mm 0 0; color: #33414f; font-size: 8.3pt; line-height: 1.42; }
  .proposal-card blockquote { margin: 2mm 0 0; border-left: 1.2mm solid #3cb4f0; border-radius: 0 2mm 2mm 0; padding: 1.8mm 2.6mm; color: #28469f; background: #eef7ff; font-size: 7.9pt; line-height: 1.38; font-style: italic; }
  .proposal-card blockquote cite { display: block; margin-top: 1mm; color: #7f93b5; font-size: 6.2pt; font-style: normal; font-weight: 700; }
  .article-chips { display: flex; flex-wrap: wrap; gap: 1.4mm; margin: 2mm 0 0; padding: 0; list-style: none; }
  .article-chips li { border: 0.3mm solid #d8e6fa; border-radius: 1.6mm; padding: 0.8mm 2mm; color: #33414f; background: #f6faff; font-size: 6.6pt; line-height: 1.25; }
  .article-chips b { color: #0d3fb0; font-weight: 800; }
  .article-chips-empty { margin: 2mm 0 0; color: #6b7885; font-size: 6.9pt; line-height: 1.3; font-style: italic; }

  .impact-table { width: 100%; border-collapse: collapse; }
  .impact-table th { border-bottom: 0.5mm solid #126ff5; padding: 0 2.4mm 1.4mm; color: #2589ea; font-size: 6.4pt; font-weight: 800; letter-spacing: 0.9pt; text-align: left; text-transform: uppercase; }
  .impact-table td { border-bottom: 0.35mm solid #e3e8ef; padding: 2.2mm 2.4mm; color: #33414f; font-size: 8.1pt; line-height: 1.35; vertical-align: top; }
  .impact-table td small { display: block; margin-top: 0.8mm; color: #6b7885; font-size: 6.4pt; }
  .impact-table tr:nth-child(even) td { background: #fbfcfe; }
  .impact-number { width: 20mm; color: #0d3fb0; font-weight: 800; white-space: nowrap; }
  .impact-count { width: 20mm; color: #126ff5; font-size: 11pt; font-weight: 800; text-align: center; }

  .closing-body { display: flex; flex-direction: column; }
  .section-intro { max-width: 165mm; margin: 0 0 4mm; color: #6b7885; font-size: 9.4pt; line-height: 1.5; }
  .action-list { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 0; padding: 0; list-style: none; }
  .action-list li { display: grid; min-height: 28mm; grid-template-columns: 10mm 1fr; gap: 2.5mm; align-items: start; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 3mm; background: #fbfcfe; }
  .action-list li:last-child:nth-child(odd) { grid-column: 1 / -1; min-height: 22mm; }
  .action-list i { display: grid; width: 8mm; height: 8mm; place-items: center; border-radius: 50%; color: #ffffff; background: #126ff5; font-size: 8pt; font-style: normal; font-weight: 800; }
  .action-list p { margin: 0; color: #33414f; font-size: 9pt; line-height: 1.45; }
  .traceability-card { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 3mm; margin-top: 6mm; border: 0.35mm solid #e3e8ef; border-radius: 2.6mm; padding: 3.2mm 3.5mm; background: #ffffff; }
  .traceability-card span, .traceability-card strong { display: block; }
  .traceability-card span { color: #2589ea; font-size: 6.3pt; font-weight: 800; letter-spacing: 1pt; text-transform: uppercase; }
  .traceability-card strong { margin-top: 1mm; color: #10233d; font-size: 7.8pt; line-height: 1.3; font-weight: 700; }
  .synthesis-block { margin-top: auto; border-radius: 3mm; padding: 6mm 7mm; color: #ffffff; background: linear-gradient(112deg, #0d3fb0, #126ff5 65%, #2589ea); box-shadow: 0 2mm 6mm rgba(13, 63, 176, 0.18); }
  .synthesis-block > span { display: block; color: #cceeff; font-size: 7pt; font-weight: 800; letter-spacing: 1.6pt; text-transform: uppercase; }
  .synthesis-block p { margin: 2mm 0 0; color: #ffffff; font-size: 12.5pt; line-height: 1.5; font-weight: 700; }
  .synthesis-block small { display: block; margin-top: 3mm; color: #d8f2ff; font-size: 7pt; }

  .institutional-footer { position: absolute; right: 0; bottom: 0; left: 0; display: flex; height: 15mm; align-items: center; justify-content: space-between; gap: 8mm; border-top: 0.35mm solid #e3e8ef; padding: 2mm 14mm; background: #fbfcfe; }
  .footer-brand { display: flex; min-width: 0; align-items: center; gap: 2.2mm; }
  .footer-brand strong, .footer-brand small { display: block; }
  .footer-brand strong { color: #33414f; font-size: 6.4pt; line-height: 1.1; font-weight: 700; }
  .footer-brand small { margin-top: 0.6mm; color: #6b7885; font-size: 5.7pt; }
  .footer-municipal-logo { width: 8.4mm; height: 8.4mm; object-fit: contain; }
  .footer-dia-logo { width: 25mm; height: 8mm; object-fit: contain; }
  .footer-attribution { color: #9aa6b2; font-size: 6.3pt; line-height: 1.25; text-align: right; }
  .footer-attribution small { display: block; margin-top: 0.7mm; color: #b0bac4; font-size: 5.6pt; }

  @media screen {
    body { padding: 12mm 0; background: #dfe5ec; }
    .pdf-page { margin: 0 auto 10mm; box-shadow: 0 4mm 14mm rgba(16, 35, 61, 0.18); }
  }
`;

export function renderInstitutionalSummary(
  payload: SummaryPayload,
  options: InstitutionalSummaryOptions,
  mode: { print?: boolean } = {}
): string {
  /*
   * Paginacion dinamica: portada + lo registrado + lo redactado + cierre.
   *
   * Antes era `const total = 4` con las secciones repartidas de dos en dos, asi
   * que el documento no podia crecer aunque el material diera para mas.
   *
   * El encabezado de cada pagina lleva el titulo de SU seccion y no un rotulo
   * fijo ("Hallazgos principales" / "Implicancias para la gestion"): con un
   * numero variable de secciones, dos rotulos no alcanzan, y el titulo real le
   * dice al lector donde esta parado.
   */
  const material = payload.material;

  /**
   * Cada parte del documento: cómo se anuncia en la portada y cómo se pagina.
   *
   * `cuerpos` lleva el alto estimado de cada página además de su HTML, para poder
   * juntar dos partes cortas en una sola hoja más abajo.
   */
  type DocumentPart = { titulo: string; detalle: string; registrado: boolean; cuerpos: Array<{ html: string; alto: number }> };
  const partes: DocumentPart[] = [];
  const sumar = <T,>(items: T[], alto: (item: T) => number) => items.reduce((total, item) => total + alto(item), 0);

  if (material?.expositores.length) {
    const numero = partes.length + 1;
    const organizaciones = material.expositores.length;
    const conPropuestas = material.expositores.filter((presenter) => presenter.propuestas > 0).length;
    const intro =
      "Organizaciones que presentaron material en esta audiencia. Sale del expediente: cada ficha resume el documento que la organización aportó, tal como fue registrado.";
    /*
     * Las tarjetas van a dos columnas, así que para paginar cada una cuesta
     * media fila. Para el alto de la página, en cambio, hay que contar FILAS: con
     * tres organizaciones la segunda fila queda a medias y ocupa igual, y
     * estimarla como media fila hacía que la página se creyera 25 mm más corta de
     * lo que era (así se pasaba de largo la 2ª audiencia).
     */
    const FILA_MM = 48;
    const alto = () => FILA_MM / 2;
    const paginas = paginate(material.expositores, CUERPO_MM - ENCABEZADO_MM, alto);
    partes.push({
      titulo: "Quiénes expusieron",
      detalle: `${organizaciones} ${organizaciones === 1 ? "organización presentó" : "organizaciones presentaron"} material${
        conPropuestas ? `; ${conPropuestas} con propuestas normativas concretas` : ""
      }.`,
      registrado: true,
      cuerpos: paginas.map((chunk, indice) => ({
        html: renderPresentersBody(chunk, numero, indice > 0, intro),
        alto: ENCABEZADO_MM + Math.ceil(chunk.length / 2) * FILA_MM
      }))
    });
  }

  if (material?.propuestas.length) {
    const numero = partes.length + 1;
    const intro =
      "Cada propuesta con la cita textual del documento que la respalda y los artículos del Código que alcanza. Las citas fueron verificadas contra el texto original.";
    /*
     * El costo de una propuesta depende de lo que traiga: el resumen, la cita y
     * los artículos son opcionales y cada uno suma. Un encabezado de organización
     * suma aparte, y por eso se pagina sobre una lista con marcadores de grupo:
     * si no, un grupo nuevo al pie de página empujaba su primera propuesta afuera.
     */
    const conGrupo = material.propuestas.map((proposal, indice) => ({
      proposal,
      abreGrupo: indice === 0 || material.propuestas[indice - 1].organizacion !== proposal.organizacion
    }));
    // Los 11 mm de descuento cubren el encabezado extra que aparece cuando un
    // grupo se parte entre dos páginas: la segunda repite el nombre de la
    // organización, y eso no se sabe hasta después de paginar.
    const alto = ({ proposal, abreGrupo }: (typeof conGrupo)[number]) => {
      const titulo = Math.ceil(Math.min(proposal.titulo.length, 130) / 95) * 4.6;
      const resumen = Math.ceil(Math.min(proposal.resumen.length, 400) / 105) * 3.4;
      const cita = proposal.cita ? Math.ceil(Math.min(proposal.cita.length, 260) / 105) * 3.2 + 7 : 0;
      // Las etiquetas de artículos se acomodan de a dos por línea.
      const articulos = proposal.articulos.length ? Math.ceil(Math.min(proposal.articulos.length, 4) / 2) * 4.6 + 2.4 : 5;
      return (abreGrupo ? 11 : 0) + 8 + titulo + resumen + cita + articulos;
    };
    const paginas = paginate(conGrupo, CUERPO_MM - ENCABEZADO_MM - 11, alto);
    partes.push({
      titulo: "Qué propuso cada una",
      detalle: `${material.propuestas.length} ${
        material.propuestas.length === 1 ? "propuesta concreta" : "propuestas concretas"
      } con su respaldo textual y los artículos que tocan.`,
      registrado: true,
      cuerpos: paginas.map((chunk, indice) => ({
        html: renderProposalsBody(
          chunk.map((item) => item.proposal),
          numero,
          indice > 0,
          intro
        ),
        alto: ENCABEZADO_MM + sumar(chunk, alto)
      }))
    });
  }

  if (material?.impacto.length) {
    const numero = partes.length + 1;
    const intro =
      "Vista agregada: qué artículos del Código de Planeamiento Urbano vigente concentran las propuestas presentadas, ordenados por cuántas los alcanzan.";
    // La fila la manda su celda más alta: la de organizaciones (que apila los
    // nombres y debajo las relaciones) o la de qué regula el artículo.
    const alto = (articulo: SummaryArticleImpact) => {
      const organizaciones = [...new Set(articulo.propuestas.map((item) => item.organizacion))].join(" · ");
      const relaciones = [...new Set(articulo.propuestas.map((item) => item.relacion))].join(" · ");
      const quienes =
        Math.ceil(Math.min(organizaciones.length, 150) / 55) * 3.9 + Math.ceil(Math.min(relaciones.length, 90) / 62) * 3 + 0.8;
      const regula = Math.ceil(Math.min(Math.max(articulo.titulo.length, 20), 110) / 26) * 3.9;
      return 4.6 + Math.max(quienes, regula);
    };
    const paginas = paginate(material.impacto, CUERPO_MM - ENCABEZADO_MM - 8, alto);
    partes.push({
      titulo: "Qué artículos del Código se tocan",
      detalle: `${material.impacto.length} ${
        material.impacto.length === 1 ? "artículo alcanzado" : "artículos alcanzados"
      } por lo presentado; el más demandado reúne ${material.impacto[0].propuestas.length}.`,
      registrado: true,
      cuerpos: paginas.map((chunk, indice) => ({
        html: renderImpactBody(chunk, numero, indice > 0, intro),
        alto: ENCABEZADO_MM + 8 + sumar(chunk, alto)
      }))
    });
  }

  // Lo redactado por el modelo: una sección por página, como hasta ahora. Con el
  // presupuesto actual (~2.600 caracteres) dos ya no entran en los 235 mm útiles.
  for (const section of payload.secciones) {
    partes.push({
      titulo: section.titulo,
      detalle: section.parrafos[0] ? firstSentence(section.parrafos[0]) : "Contenido verificado en el material de la audiencia.",
      registrado: false,
      cuerpos: [{ html: renderSummarySection(section, partes.length + 1), alto: CUERPO_MM }]
    });
  }

  /*
   * Dos secciones registradas comparten hoja cuando entran juntas.
   *
   * Una audiencia con dos organizaciones y tres artículos tocados producía tres
   * páginas al 30%, y un documento institucional con tres hojas casi vacías se
   * lee como relleno. Sólo se juntan secciones REGISTRADAS (las redactadas están
   * dimensionadas para ocupar una hoja entera), sólo de partes distintas --dos
   * páginas de la misma parte se separaron porque no entraban-- y como máximo dos
   * por hoja, para que el lector siga encontrando cada sección por su título.
   */
  type BodyPage = { titulos: string[]; html: string; alto: number; parte: number; registrado: boolean };
  const cuerpos: BodyPage[] = [];
  for (const [indiceParte, parte] of partes.entries()) {
    for (const cuerpo of parte.cuerpos) {
      const ultima = cuerpos[cuerpos.length - 1];
      const juntar =
        parte.registrado &&
        ultima?.registrado &&
        ultima.parte !== indiceParte &&
        ultima.titulos.length < 2 &&
        ultima.alto + cuerpo.alto + SEPARADOR_MM <= CUERPO_MM;
      if (juntar) {
        ultima.titulos.push(parte.titulo);
        ultima.html += cuerpo.html;
        ultima.alto += cuerpo.alto + SEPARADOR_MM;
        ultima.parte = indiceParte;
        continue;
      }
      cuerpos.push({
        titulos: [parte.titulo],
        html: cuerpo.html,
        alto: cuerpo.alto,
        parte: indiceParte,
        registrado: parte.registrado
      });
    }
  }

  const total = cuerpos.length + 2;
  const pages = [
    renderPageOne(payload, options, partes, total),
    ...cuerpos.map((entrada, indice) =>
      renderBodyPage(entrada.titulos.join(" · "), entrada.html, options, indice + 2, total)
    ),
    renderClosingPage(payload, options, total, total)
  ].join("");

  return [
    "<!doctype html>",
    `<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.titulo)}</title><style>${INSTITUTIONAL_SUMMARY_STYLES}</style></head><body>`,
    `<div class="pdf-document">${pages}</div>`,
    mode.print ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 350); });</script>` : "",
    "</body></html>"
  ].join("");
}
