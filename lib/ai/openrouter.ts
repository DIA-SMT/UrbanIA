import OpenAI from "openai";

export type UrbanAssistantMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type UrbanAssistantResponse = {
  answer: string;
  model: string;
  provider: "openrouter";
};

const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function hasOpenRouterConfig() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function askUrbanAssistant(messages: UrbanAssistantMessage[]): Promise<UrbanAssistantResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "UrbanIA"
    }
  });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    max_tokens: 900,
    messages
  });

  return {
    answer: completion.choices[0]?.message?.content?.trim() || "No se pudo generar una respuesta.",
    model,
    provider: "openrouter"
  };
}

export function buildMigueSystemPrompt() {
  return [
    "Sos Migue, el asistente urbano de UrbanIA.",
    "Ayudas a ciudadanos, tecnicos y funcionarios a entender propuestas urbanas, normativa, audiencias, datos territoriales y escenarios de decision.",
    "Tu tono es cercano, profesional, municipal y claro.",
    "No inventes articulos, ordenanzas ni datos. Si falta una fuente real, aclaralo.",
    "Cuando respondas, separa la respuesta en sintesis, puntos clave y siguientes pasos.",
    "Recorda que la IA propone y el equipo municipal valida."
  ].join(" ");
}
