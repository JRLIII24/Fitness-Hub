/**
 * Shared Anthropic tool-use helper.
 *
 * callAnthropicWithTool<T>() handles:
 * - tool_use extraction from response
 * - sanitizeToolOutput() preprocessing (strips markdown fences)
 * - Zod validation
 * - Timeout (25s)
 * - Error mapping (529→503, timeout→504)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

interface CallOptions<T> {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>;
  zodSchema: ZodSchema<T>;
  maxTokens?: number;
}

interface SuccessResult<T> {
  data: T;
  error?: undefined;
  status?: undefined;
}

interface ErrorResult {
  data?: undefined;
  error: string;
  status: number;
}

type CallResult<T> = SuccessResult<T> | ErrorResult;

/**
 * Strip markdown code fences and extract JSON from potentially
 * wrapped LLM output. Defensive against model regressions.
 */
export function sanitizeToolOutput(raw: unknown): unknown {
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw !== "string") return raw;

  let s = raw.trim();

  // Strip markdown code fences
  if (s.startsWith("```")) {
    const firstNewline = s.indexOf("\n");
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
    if (s.endsWith("```")) s = s.slice(0, -3);
    s = s.trim();
  }

  // Extract first JSON object or array
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  let start = -1;
  if (objStart >= 0 && arrStart >= 0) start = Math.min(objStart, arrStart);
  else if (objStart >= 0) start = objStart;
  else if (arrStart >= 0) start = arrStart;

  if (start >= 0) {
    const isArr = s[start] === "[";
    const closeChar = isArr ? "]" : "}";
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === s[start]) depth++;
      else if (s[i] === closeChar) depth--;
      if (depth === 0) {
        s = s.slice(start, i + 1);
        break;
      }
    }
  }

  try {
    return JSON.parse(s);
  } catch {
    return raw;
  }
}

export async function callAnthropicWithTool<T>(
  opts: CallOptions<T>,
): Promise<CallResult<T>> {
  const {
    client,
    model,
    systemPrompt,
    messages,
    toolName,
    toolDescription,
    toolSchema,
    zodSchema,
    maxTokens = 2048,
  } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: toolName,
            description: toolDescription,
            input_schema: toolSchema as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: toolName },
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    // Extract tool_use block
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { error: "No tool output from AI", status: 500 };
    }

    const sanitized = sanitizeToolOutput(toolBlock.input);
    const parsed = zodSchema.safeParse(sanitized);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[anthropic-helper] Zod validation failed:", JSON.stringify(parsed.error.issues, null, 2));
        console.error("[anthropic-helper] Raw tool input:", JSON.stringify(toolBlock.input, null, 2));
      }
      return { error: "Invalid AI response structure", status: 500 };
    }

    return { data: parsed.data };
  } catch (err: unknown) {
    clearTimeout(timeout);

    if (err instanceof Error && err.name === "AbortError") {
      return { error: "AI request timed out", status: 504 };
    }

    // Anthropic overloaded
    if (
      err instanceof Anthropic.APIError &&
      (err.status === 529 || err.status === 503)
    ) {
      return { error: "AI service temporarily unavailable", status: 503 };
    }

    if (err instanceof Anthropic.APIError && err.status === 429) {
      return { error: "AI rate limit exceeded", status: 429 };
    }

    throw err;
  }
}
