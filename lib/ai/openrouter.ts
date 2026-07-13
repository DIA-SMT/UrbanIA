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

export async function askUrbanAssistant(
  messages: UrbanAssistantMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<UrbanAssistantResponse> {
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
    temperature: options?.temperature ?? 0.35,
    max_tokens: options?.maxTokens ?? 900,
    messages
  });

  return {
    answer: completion.choices[0]?.message?.content?.trim() || "No se pudo generar una respuesta.",
    model,
    provider: "openrouter"
  };
}
