/**
 * AI Coach Chat API — STREAMING
 * POST /api/ai/coach
 *
 * Returns Server-Sent Events:
 *   event: text     → { delta: string }   (incremental reply text)
 *   event: action   → { action, data }    (structured action payload)
 *   event: done     → {}                  (stream complete)
 *   event: error    → { error, status? }  (error)
 *
 * Model: Haiku (fast, cost-efficient)
 * No rate limit (Haiku is cost-efficient)
 */

import { NextResponse } from "next/server";
import { streamObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { buildCoachSystemPrompt } from "@/lib/ai-prompts/coach";
import { CoachResponseSchema } from "@/lib/coach/types";
import type { CoachRequest, SaveMemoryActionData } from "@/lib/coach/types";
import {
  getCoachMemories,
  saveCoachMemory,
  formatMemoriesForPrompt,
} from "@/lib/coach/memory";

// ── SSE helpers ──────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const provider = getAnthropicProvider();
    if (!provider) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = (await request.json()) as CoachRequest;
    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    // Fetch persistent memories for this user
    const memories = await getCoachMemories(supabase, user.id);
    const memoriesBlock = formatMemoriesForPrompt(memories);
    const systemPrompt = buildCoachSystemPrompt(memoriesBlock || undefined);

    // Build conversation messages
    const messages = [
      ...(body.conversation_history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `${body.message}\n\n---\nCurrent context: ${JSON.stringify(body.context ?? {})}`,
      },
    ];

    // Stream structured object and convert to SSE format the client expects
    const result = streamObject({
      model: provider(HAIKU),
      schema: CoachResponseSchema,
      system: systemPrompt,
      messages,
      maxOutputTokens: 2048,
    });

    const encoder = new TextEncoder();
    let prevReplyLen = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream partial objects — emit reply deltas as they arrive
          for await (const partial of result.partialObjectStream) {
            const reply = partial.reply ?? "";
            if (reply.length > prevReplyLen) {
              const delta = reply.slice(prevReplyLen);
              prevReplyLen = reply.length;
              controller.enqueue(
                encoder.encode(sseEvent("text", { delta })),
              );
            }
          }

          // Get the final validated object
          const final = await result.object;
          const action = final.action ?? "none";
          // Parse the stringified action data back into an object
          let data: Record<string, unknown> | null = null;
          if (final.data_json) {
            try {
              data = JSON.parse(final.data_json);
            } catch {
              data = null;
            }
          }

          // Handle save_memory server-side — persist to DB before emitting action
          if (action === "save_memory" && data) {
            const memData = data as unknown as SaveMemoryActionData;
            if (memData.category && memData.content) {
              await saveCoachMemory(
                supabase,
                user.id,
                memData.category,
                memData.content,
              );
            }
          }

          controller.enqueue(
            encoder.encode(sseEvent("action", { action, data })),
          );
          controller.enqueue(encoder.encode(sseEvent("done", {})));
        } catch (err) {
          logger.error("Coach streaming error:", err);
          controller.enqueue(
            encoder.encode(
              sseEvent("error", { error: "Stream failed" }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error("Coach API error:", error);
    return NextResponse.json(
      { error: "Failed to process coach request" },
      { status: 500 },
    );
  }
}
