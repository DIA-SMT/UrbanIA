import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderInstitutionalSummary, type SummaryPayload } from "../lib/hearings/summary-document";
import { renderHtmlToPdf } from "../lib/pdf/render-pdf";

const projectRoot = process.cwd();

function pngDataUri(relativePath: string): string {
  return `data:image/png;base64,${readFileSync(path.join(projectRoot, relativePath)).toString("base64")}`;
}

const payload: SummaryPayload = {
  titulo: "Movilidad segura y accesibilidad en corredores urbanos prioritarios",
  bajada:
    "Síntesis de los aportes presentados para ordenar intervenciones, mejorar cruces peatonales y facilitar el acceso al transporte público.",
  deQueSeTrata:
    "Esta audiencia de muestra permite controlar la presentación del resumen ejecutivo antes de usarlo con material real. El contenido simula un debate sobre movilidad, accesibilidad y seguridad vial. Las cifras, nombres y medidas incluidas son exclusivamente de ejemplo. No deben interpretarse como decisiones ni datos oficiales.",
  expositor: "Equipo técnico de muestra",
  destinatario: "Gabinete y áreas municipales",
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
