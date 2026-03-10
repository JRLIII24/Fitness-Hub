/**
 * Vercel AI SDK provider configuration.
 *
 * Replaces anthropic-client.ts + anthropic-helper.ts with native AI SDK calls.
 * Uses @ai-sdk/anthropic for structured object generation and streaming.
 */

import { createAnthropic } from "@ai-sdk/anthropic";

let _provider: ReturnType<typeof createAnthropic> | null = null;

export function getAnthropicProvider() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_provider) {
    _provider = createAnthropic({ apiKey: key });
  }
  return _provider;
}

export const SONNET =
  process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-20250514";
export const HAIKU =
  process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001";
