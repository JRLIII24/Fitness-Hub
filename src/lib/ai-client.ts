/**
 * Shared OpenRouter AI client.
 *
 * Uses the OpenAI SDK pointed at OpenRouter's base URL.
 * Free model: meta-llama/llama-3.3-70b-instruct:free
 */

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getAIClient(): OpenAI | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:3000",
        "X-Title": "FitHub",
      },
    });
  }
  return _client;
}

export const AI_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
