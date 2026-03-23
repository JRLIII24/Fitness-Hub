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
import { getAnthropicProvider, SONNET } from "@/lib/ai-sdk";
import { buildCoachSystemPrompt } from "@/lib/ai-prompts/coach";
import { CoachResponseSchema } from "@/lib/coach/types";
import type { CoachRequest, SaveMemoryActionData } from "@/lib/coach/types";
import {
  getCoachMemories,
  saveCoachMemory,
  formatMemoriesForPrompt,
} from "@/lib/coach/memory";
import {
  getOrCreateConversation,
  saveMessage,
} from "@/lib/coach/conversation";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";
import { getCachedOrComputeReadiness } from "@/lib/readiness/server";

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

    // Fetch persistent memories and safety-critical context server-side
    const [memories, fatigueSnapshot, readinessResult, { data: muscleRecoveryRows }] = await Promise.all([
      getCoachMemories(supabase, user.id),
      getCachedOrComputeFatigueSnapshot(user.id).catch(() => null),
      getCachedOrComputeReadiness(user.id).catch(() => null),
      supabase.rpc('get_muscle_group_recovery', {
        p_user_id: user.id, p_lookback_days: 7
      }).then(res => res, () => ({ data: null })),
    ]);

    // Build muscle recovery map: muscle_group → recovery pct (0-100)
    const muscleRecoveryMap: Record<string, number> | null =
      muscleRecoveryRows && Array.isArray(muscleRecoveryRows) && muscleRecoveryRows.length > 0
        ? Object.fromEntries(
            muscleRecoveryRows.map((row: { muscle_group: string; hours_since_trained: number }) => [
              row.muscle_group,
              Math.min(100, Math.round((row.hours_since_trained / 48) * 100)),
            ])
          )
        : null;

    const memoriesBlock = formatMemoriesForPrompt(memories);
    const systemPrompt = buildCoachSystemPrompt(memoriesBlock || undefined);

    // Compute ACWR status from server data (don't trust client-supplied value)
    let serverAcwrStatus: string | null = null;
    if (fatigueSnapshot?.metadata) {
      const { avgLoad7d, avgLoad28d } = fatigueSnapshot.metadata;
      if (avgLoad7d != null && avgLoad28d != null && avgLoad28d > 0) {
        const acr = avgLoad7d / avgLoad28d;
        if (acr > 1.5) serverAcwrStatus = "danger";
        else if (acr > 1.3) serverAcwrStatus = "high";
        else if (acr > 1.1) serverAcwrStatus = "elevated";
        else if (acr >= 0.8) serverAcwrStatus = "optimal";
        else serverAcwrStatus = "underloaded";
      }
    }

    // Override client context with server-fetched safety-critical fields
    const serverContext = {
      ...(body.context ?? {}),
      ...(serverAcwrStatus != null && { acwr_status: serverAcwrStatus }),
      ...(readinessResult != null && { readiness_score: readinessResult.readinessScore }),
      ...(readinessResult != null && { systemic_score: readinessResult.systemic_score }),
      ...(muscleRecoveryMap != null && { muscle_recovery_map: muscleRecoveryMap }),
    };

    // Build conversation messages
    const messages = [
      ...(body.conversation_history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `${body.message}\n\n---\nCurrent context: ${JSON.stringify(serverContext)}`,
      },
    ];

    // Stream structured object and convert to SSE format the client expects
    const result = streamObject({
      model: provider(SONNET),
      schema: CoachResponseSchema,
      system: systemPrompt,
      messages,
      maxOutputTokens: 4096,
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

          // ACWR safety guardrail — programmatically enforce deload regardless of LLM output
          if (action === "show_prescription" && data) {
            const acwrStatus = serverAcwrStatus ?? body.context?.acwr_status;
            if (acwrStatus === "danger" || acwrStatus === "high") {
              data.readiness_factor = "deload";
              if (typeof data.progressive_overload_pct === "number" && data.progressive_overload_pct > 0) {
                data.progressive_overload_pct = 0;
              }
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

          // Persist conversation messages server-side (fire-and-forget)
          try {
            const convId = body.conversation_id
              ? body.conversation_id
              : await getOrCreateConversation(supabase, user.id);
            await Promise.all([
              saveMessage(supabase, convId, user.id, {
                role: "user",
                content: body.message,
              }),
              saveMessage(supabase, convId, user.id, {
                role: "assistant",
                content: final.reply ?? "",
                action: action !== "none" ? (action as import("@/lib/coach/types").CoachAction) : undefined,
                actionData: data ?? undefined,
              }),
            ]);
          } catch (e) {
            logger.error("Failed to persist conversation:", e);
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
