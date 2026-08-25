import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  renderInstitutionalSummary,
  type HearingSummaryMaterial,
  type SummaryPayload
} from "../lib/hearings/summary-document";
import { renderHtmlToPdf } from "../lib/pdf/render-pdf";

const projectRoot = process.cwd();

function pngDataUri(relativePath: string): string {
  return `data:image/png;base64,${readFileSync(path.join(projectRoot, relativePath)).toString("base64")}`;
}

/*
 * Material de muestra en el PEOR caso realista: seis organizaciones, propuestas
 * de largo desparejo y varias tocando el mismo artículo. Sirve para comprobar la
 * paginación de las páginas registradas, que es donde el documento puede
 * desbordar (las páginas tienen alto fijo y el exportador aborta si algo se sale).
 */
const ORGANIZACIONES = [
  "Colegio de Arquitectos de Tucumán",
  "Consejo Profesional de Ingeniería",
  "Facultad de Arquitectura y Urbanismo (UNT)",
  "Asociación de Ciclistas Urbanos",
  "Cámara de la Construcción",
  "Vecinos Autoconvocados de Barrio Sur"
];

const RELACIONES = ["Modifica", "Se relaciona con", "Posible conflicto con", "Reemplaza"];

const material: HearingSummaryMaterial = {
  expositores: ORGANIZACIONES.map((organizacion, indice) => ({
    organizacion,
    documento: `Presentacion ${indice + 1} - muestra.pdf`,
    // Todos los campos al tope de su clamp: si el peor caso entra, entra
    // cualquiera. El exportador aborta si algo se sale de la caja imprimible,
    // así que esta muestra es la prueba de la paginación.
    queTrajo:
      "Documento de muestra que plantea criterios de altura, retiros y ocupación del suelo para los corredores centrales de la ciudad. Incluye un diagnóstico de la situación actual, una propuesta de indicadores y un anexo con la comparación entre el régimen vigente y el propuesto. Todos los valores son ficticios y sirven únicamente para el control visual del documento antes de usarlo con material real.",
    tipo: indice % 2 === 0 ? "Propuesta normativa" : "Presentación institucional",
    propuestas: indice % 2 === 0 ? [3, 5, 4][Math.floor(indice / 2)] : 0
  })),
  propuestas: [],
  impacto: []
};

for (const presenter of material.expositores) {
  for (let indice = 0; indice < presenter.propuestas; indice += 1) {
    const numero = String(5 + ((indice * 7 + presenter.organizacion.length) % 9) * 3);
    material.propuestas.push({
      organizacion: presenter.organizacion,
      documento: presenter.documento,
      titulo: `Propuesta de muestra ${indice + 1} sobre indicadores urbanísticos, alturas máximas y retiros del corredor central`,
      resumen:
        "Texto ficticio que describe el alcance de la propuesta, el problema que busca resolver y el instrumento normativo sugerido. Se incluye a propósito con una extensión cercana al máximo permitido para verificar que la tarjeta no desborde la página ni recorte el contenido de manera silenciosa, ni empuje al resto del bloque fuera del área imprimible del documento.",
      cita: "Cita textual de muestra tomada del documento presentado, que respalda la propuesta y se verifica contra el original antes de publicarse; se extiende hasta el máximo previsto para comprobar el alto del recuadro.",
      paginas: [indice + 2, indice + 3],
      articulos: [
        { numero, titulo: "Distritos residenciales y sus indicadores", relacion: RELACIONES[indice % RELACIONES.length], porQue: "" },
        { numero: String(Number(numero) + 13), titulo: "Régimen de excepciones", relacion: "Se relaciona con", porQue: "" },
        { numero: String(Number(numero) + 21), titulo: "Espacio público y arbolado", relacion: "Modifica", porQue: "" },
        { numero: String(Number(numero) + 4), titulo: "Estacionamiento y carga", relacion: "Posible conflicto con", porQue: "" }
      ]
    });
  }
}

for (const proposal of material.propuestas) {
  for (const articulo of proposal.articulos) {
    const actual = material.impacto.find((item) => item.numero === articulo.numero);
    const entrada = { organizacion: proposal.organizacion, titulo: proposal.titulo, relacion: articulo.relacion };
    if (actual) actual.propuestas.push(entrada);
    else material.impacto.push({ numero: articulo.numero, titulo: articulo.titulo, propuestas: [entrada] });
  }
}
material.impacto.sort((a, b) => b.propuestas.length - a.propuestas.length || Number(a.numero) - Number(b.numero));

const payload: SummaryPayload = {
  titulo: "Movilidad segura y accesibilidad en corredores urbanos prioritarios",
  bajada:
    "Síntesis de los aportes presentados para ordenar intervenciones, mejorar cruces peatonales y facilitar el acceso al transporte público.",
  deQueSeTrata:
    "Esta audiencia de muestra permite controlar la presentación del resumen ejecutivo antes de usarlo con material real. El contenido simula un debate sobre movilidad, accesibilidad y seguridad vial. Las cifras, nombres y medidas incluidas son exclusivamente de ejemplo. No deben interpretarse como decisiones ni datos oficiales.",
  expositores: ORGANIZACIONES,
  destinatario: "Gabinete y áreas municipales",
  material,
  estructura: "Diagnóstico | Experiencia ciudadana | Alternativas | Criterios de seguimiento",
  secciones: [
    {
      titulo: "Condiciones actuales y puntos críticos",
      parrafos: [
        "El material de muestra identifica dificultades de cruce en avenidas de alto tránsito, veredas con recorridos discontinuos y paradas sin una conexión peatonal clara. También describe conflictos recurrentes entre los tiempos semafóricos, la circulación vehicular y los desplazamientos de personas con movilidad reducida.",
        "Para la gestión municipal, el planteo propone ordenar el diagnóstico por corredor y no como intervenciones aisladas. Esa lectura permitiría priorizar puntos donde una mejora coordinada beneficie al mismo tiempo la seguridad vial, la accesibilidad y el acceso cotidiano a los servicios urbanos."
      ],
      datos: [
        { valor: "12", descripcion: "intersecciones incluidas como valor de ejemplo para la prueba visual" },
        { valor: "3", descripcion: "corredores simulados para comprobar la composición de las tarjetas" }
      ],
      destacados: ["Los valores de esta muestra no corresponden a una audiencia real."]
    },
    {
      titulo: "Experiencia de peatones y usuarios del transporte",
      parrafos: [
        "Los testimonios ficticios señalan esperas prolongadas, falta de continuidad entre rampas y sendas, y dificultades para reconocer recorridos seguros durante la noche. La prueba incorpora estas situaciones para verificar que los párrafos extensos mantengan una lectura clara y una jerarquía visual estable.",
        "El enfoque ciudadano obliga a evaluar cada intervención desde el recorrido completo y no sólo desde la obra puntual. Para el Municipio, esto supone coordinar señalización, iluminación, mantenimiento y fiscalización bajo un mismo criterio operativo."
      ],
      destacados: ["La accesibilidad se evalúa en el recorrido completo, no en elementos aislados."]
    },
    {
      titulo: "Alternativas de intervención coordinada",
      parrafos: [
        "La muestra organiza las alternativas en acciones inmediatas, adecuaciones físicas y cambios operativos. Entre ellas aparecen la revisión de fases semafóricas, la recuperación de sendas, la ubicación de paradas y la eliminación de obstáculos en esquinas, siempre como contenido ficticio para probar el documento.",
        "La comparación permite observar qué medidas podrían ejecutarse con mantenimiento ordinario y cuáles requerirían proyecto, presupuesto o coordinación externa. Esa distinción ayuda a preparar una agenda municipal realista y con responsables identificables."
      ],
      datos: [
        { valor: "90 días", descripcion: "plazo ficticio utilizado para comprobar valores de mayor longitud" },
        { valor: "4 áreas", descripcion: "cantidad simulada de equipos que participarían en la coordinación" }
      ]
    },
    {
      titulo: "Seguimiento, validación y trazabilidad",
      parrafos: [
        "El esquema de prueba plantea registrar el estado inicial, la intervención realizada y una verificación posterior en cada punto. También propone conservar la fuente de cada observación para diferenciar datos técnicos, solicitudes ciudadanas y decisiones adoptadas por las áreas competentes.",
        "Para el gabinete, una trazabilidad simple facilita revisar avances y explicar por qué se priorizó cada acción. Ninguna conclusión generada con asistencia de inteligencia artificial reemplaza la revisión técnica ni la validación institucional."
      ],
      destacados: ["La IA orienta; el equipo municipal revisa, redacta y valida."]
    }
  ],
  lineasDeAccion: [
    "Validar con las áreas responsables un inventario único de puntos críticos y definir el criterio de prioridad.",
    "Separar las mejoras de ejecución inmediata de aquellas que requieren proyecto, presupuesto o intervención externa.",
    "Asignar responsables y fechas de revisión para cada corredor incorporado al plan de trabajo.",
    "Registrar las fuentes, decisiones y avances para sostener la trazabilidad del proceso.",
    "Contrastar los resultados con recorridos de verificación y aportes ciudadanos documentados."
  ],
  enSintesis:
    "La muestra presenta un método para convertir aportes dispersos en una agenda municipal verificable. El documento prioriza evidencia, impacto ciudadano y trazabilidad, y mantiene cada conclusión sujeta a revisión del equipo responsable."
};

async function main() {
  const html = renderInstitutionalSummary(payload, {
    hearingTitle: "Audiencia pública de muestra - datos ficticios",
    when: "Agosto de 2026",
    docCode: "AUD-MUESTRA",
    monthYear: "Agosto de 2026",
    sourceSummary: "Transcripción y documentos simulados para control visual",
    municipalHeaderLogo: pngDataUri("public/brand/logo-ciudad-smt-blanco.png"),
    municipalFooterLogo: pngDataUri("public/brand/logo-municipalidad-smt-iso.png"),
    diaLogo: pngDataUri("public/brand/logo-direccion-ia.png")
  });

  const tempDirectory = path.join(projectRoot, "tmp", "pdfs");
  const outputDirectory = path.join(projectRoot, "output", "pdf");
  mkdirSync(tempDirectory, { recursive: true });
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(tempDirectory, "resumen-ejecutivo-audiencia-muestra.html"), html, "utf8");

  const pdf = await renderHtmlToPdf(html);
  const outputPath = path.join(outputDirectory, "resumen-ejecutivo-audiencia-muestra.pdf");
  writeFileSync(outputPath, pdf);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
