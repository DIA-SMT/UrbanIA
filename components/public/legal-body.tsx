import type { LegalSection } from "@/lib/legal/content";

/**
 * Cuerpo de un documento legal. Vive aparte porque lo comparten la página
 * completa (/privacidad, /terminos) y el recuadro que se abre sobre la pantalla:
 * los dos tienen que decir exactamente lo mismo, y una segunda copia del
 * renderizador es la forma más segura de que dejen de coincidir.
 */
export function LegalSections({
  sections,
  isLight,
  compacto = false
}: {
  sections: LegalSection[];
  isLight: boolean;
  /** Dentro del recuadro el texto va un punto más chico y con menos aire. */
  compacto?: boolean;
}) {
  return (
    <div className={compacto ? "space-y-5" : "space-y-9"}>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2
            className={`font-display font-extrabold tracking-[-0.01em] ${compacto ? "text-sm" : "text-lg"} ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {section.heading}
          </h2>
          <div className={compacto ? "mt-2 space-y-2" : "mt-3 space-y-3"}>
            {renderBody(section.body, isLight, compacto)}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Agrupa las líneas que empiezan con "- " en una sola lista y deja el resto como
 * párrafos. Sin esto, cada ítem sería un párrafo suelto y una enumeración de
 * cinco proveedores se leería como cinco frases sin relación.
 */
function renderBody(body: string[], isLight: boolean, compacto: boolean) {
  const bloques: { tipo: "parrafo" | "lista"; lineas: string[] }[] = [];

  for (const linea of body) {
    const esItem = linea.startsWith("- ");
    const ultimo = bloques[bloques.length - 1];
    if (esItem && ultimo?.tipo === "lista") {
      ultimo.lineas.push(linea.slice(2));
    } else {
      bloques.push({ tipo: esItem ? "lista" : "parrafo", lineas: [esItem ? linea.slice(2) : linea] });
    }
  }

  const textoClase = `${compacto ? "text-[12.5px] leading-6" : "text-sm leading-7"} ${
    isLight ? "text-slate-600" : "text-slate-300"
  }`;

  return bloques.map((bloque, indice) =>
    bloque.tipo === "lista" ? (
      <ul key={indice} className={compacto ? "space-y-1.5" : "space-y-2"}>
        {bloque.lineas.map((linea, i) => (
          <li key={i} className={`relative pl-5 ${textoClase}`}>
            <span
              aria-hidden
              className={`absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full ${
                isLight ? "bg-civic-blue-deep" : "bg-sky-300"
              }`}
            />
            <Resaltado texto={linea} isLight={isLight} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={indice} className={textoClase}>
        <Resaltado texto={bloque.lineas[0]} isLight={isLight} />
      </p>
    )
  );
}

/**
 * Resalta los marcadores `[[...]]` de lo que el municipio todavía no definió.
 * Se muestran a propósito y en amarillo: si alguien publica el documento sin
 * completarlos, tiene que saltar a la vista en vez de pasar por texto normal.
 */
function Resaltado({ texto, isLight }: { texto: string; isLight: boolean }) {
  const partes = texto.split(/(\[\[[^\]]+\]\])/g);

  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith("[[") && parte.endsWith("]]") ? (
          <mark
            key={i}
            className={`rounded px-1 font-semibold ${
              isLight ? "bg-amber-100 text-amber-900" : "bg-amber-300/20 text-amber-100"
            }`}
            title="Pendiente de definición por el municipio"
          >
            {parte.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{parte}</span>
        )
      )}
    </>
  );
}
