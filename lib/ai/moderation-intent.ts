import "server-only";

import { askUrbanAssistant } from "@/lib/ai/openrouter";

/**
 * Segunda capa de moderación: intención, no vocabulario.
 *
 * El filtro léxico (lib/moderation) sólo ve palabras de una lista, así que "la Dra.
 * es una infeliz" le pasa por al lado: no hay ninguna mala palabra. Esta capa mira
 * qué está haciendo el texto.
 *
 * La línea que separa es: se critica LO QUE SE HACE (pasa) o se descalifica A QUIEN
 * LO HACE (no pasa). "La gestión es un desastre" es un reclamo; "la Dra. es una
 * infeliz" es un agravio. Los dos suenan enojados; sólo uno ataca a una persona.
 *
 * Ante cualquier falla del modelo se deja pasar: que se caiga OpenRouter no puede
 * dejar a un vecino sin poder presentar su reclamo.
 */

export type AggressionAnalysis = {
  agresivo: boolean;
  /** Categoría detectada. Para logs, nunca para mostrar al vecino. */
  tipo: "insulto_personal" | "amenaza" | "discriminacion" | "ninguno";
};

const MODERATION_MODEL = "openai/gpt-4o-mini";

const MODERATION_SYSTEM_PROMPT = [
  "Sos el moderador de UrbanIA, el portal de participación ciudadana de la Municipalidad de San Miguel de Tucumán.",
  "Analizás el texto que escribe un vecino y devolvés SOLO un JSON con esta forma exacta:",
  '{"agresivo": <true|false>, "tipo": "insulto_personal"|"amenaza"|"discriminacion"|"ninguno"}',
  "",
  "El criterio es UNO SOLO: ¿el texto critica lo que se hace, o descalifica a quien lo hace?",
  "",
  "agresivo = true cuando:",
  "- Descalifica a una persona o a un grupo por lo que ES, no por lo que hace: \"la doctora es una infeliz\", \"el intendente es un inútil\", \"esta mina no sirve para nada\", \"son todos unos inservibles\", \"que se vaya a su casa esta ineficiente\".",
  "- Insulta, agravia o humilla a alguien, aunque use palabras suaves o irónicas.",
  "- Amenaza con violencia o daño a alguien.",
  "- Discrimina por origen, género, religión, nacionalidad, discapacidad, edad o condición social.",
  "",
  "agresivo = false cuando:",
  "- Critica una gestión, una obra, un servicio, una decisión o el estado de la ciudad, POR DURO O ENOJADO QUE SUENE: \"es un desastre\", \"una vergüenza\", \"hace dos años que no viene nadie\", \"la gestión es pésima\", \"no funciona nada\", \"están abandonados\", \"es inadmisible\".",
  "- Denuncia un hecho o una irregularidad: \"denuncio un acto de corrupción\", \"se llevaron el material de la obra\", \"acá pasan cosas raras con la licitación\".",
  "- Expresa bronca, frustración o urgencia sin atacar a nadie: \"estoy harto\", \"ya no damos más\", \"nadie nos escucha\".",
  "- Describe problemas urbanos con palabras fuertes: basura, ratas, chorros, inseguridad, abandono.",
  "",
  "Reglas de decisión:",
  "- Criticar el desempeño de un funcionario NO es agresión: \"la Dra. no responde los pedidos\" o \"la Dra. hizo un mal trabajo\" son legítimos. Lo que no pasa es el agravio a la persona: \"la Dra. es una infeliz\".",
  "- ANTE LA DUDA, agresivo = false. Bloquear un reclamo legítimo es peor que dejar pasar un comentario áspero: el vecino se queda sin voz y el municipio sin enterarse del problema.",
  "- No juzgues la ortografía, el tono, las mayúsculas ni si el reclamo tiene razón. Sólo si agrede a alguien."
].join("\n");

/**
 * Clasifica la intención del texto. Devuelve `agresivo: false` ante cualquier error
 * (modelo caído, JSON inválido, sin API key): fallar abierto es deliberado.
 */
export async function analyzeAggression(text: string): Promise<AggressionAnalysis> {
  const safe: AggressionAnalysis = { agresivo: false, tipo: "ninguno" };

  try {
    const response = await askUrbanAssistant(
      [
        { role: "system", content: MODERATION_SYSTEM_PROMPT },
        { role: "user", content: `Texto del vecino:\n${text.slice(0, 2000)}` }
      ],
      { model: MODERATION_MODEL, json: true, maxTokens: 60, temperature: 0 }
    );

    const parsed = JSON.parse(response.answer) as { agresivo?: unknown; tipo?: unknown };

    if (parsed.agresivo !== true) {
      return safe;
    }

    const tipo =
      parsed.tipo === "insulto_personal" || parsed.tipo === "amenaza" || parsed.tipo === "discriminacion"
        ? parsed.tipo
        : "insulto_personal";

    return { agresivo: true, tipo };
  } catch (error) {
    console.warn("Moderación por intención no disponible, se deja pasar.", error instanceof Error ? error.message : error);
    return safe;
  }
}
