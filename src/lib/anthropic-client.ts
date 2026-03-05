/**
 * Shared Anthropic AI client.
 *
 * Uses the official @anthropic-ai/sdk.
 * Sonnet for complex tasks, Haiku for simple/fast tasks.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const ANTHROPIC_SONNET =
  process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-20250514";
export const ANTHROPIC_HAIKU =
  process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001";
