/**
 * AI Program Builder API
 * POST /api/ai/program-builder
 *
 * Streams a multi-week periodized training program via Sonnet using streamObject.
 * Emits SSE events: progress (per week), done (with program_id), error.
 *
 * Model: Sonnet (complex nested structured output requires stronger model)
 * Rate limit: 5/day
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { streamObject } from "ai";
import { getAnthropicProvider, SONNET } from "@/lib/ai-sdk";
import {
  PROGRAM_BUILDER_SYSTEM_PROMPT,
  ProgramSchema,
} from "@/lib/ai-prompts/program-builder";

const DAILY_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const RequestSchema = z.object({
  goal: z.string().min(1).max(200),
  weeks: z.number().min(4).max(12),
  days_per_week: z.number().min(2).max(6),
  experience_level: z.string().optional(),
  equipment_available: z.array(z.string()).optional(),
  focus_areas: z.array(z.string()).optional(),
});

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(request: Request) {
  const provider = getAnthropicProvider();
  if (!provider) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }

  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  const allowed = await rateLimit(
    `ai:program:${user.id}`,
    DAILY_LIMIT,
    ONE_DAY_MS,
  );
  if (!allowed) {
    return NextResponse.json({ limitReached: true }, { status: 429 });
  }

  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { goal, weeks, days_per_week, experience_level, equipment_available, focus_areas } =
    parsed.data;

  // Fetch profile for additional context
  const { data: profile } = await supabase
    .from("profiles")
    .select("experience_level, activity_level, fitness_goal")
    .eq("id", user.id)
    .maybeSingle();

  const contextMessage = JSON.stringify({
    goal,
    weeks,
    days_per_week,
    experience_level: experience_level || profile?.experience_level || "intermediate",
    equipment_available: equipment_available || ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
    focus_areas: focus_areas || [],
    fitness_goal: profile?.fitness_goal || null,
  });

  const result = streamObject({
    model: provider(SONNET),
    schema: ProgramSchema,
    system: PROGRAM_BUILDER_SYSTEM_PROMPT,
    prompt: `Build a ${weeks}-week ${goal} program for ${days_per_week} days per week.\n\nContext: ${contextMessage}`,
    maxOutputTokens: 16384,
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let prevWeekCount = 0;
        for await (const partial of result.partialObjectStream) {
          const wc = partial.weeks?.length ?? 0;
          if (wc > prevWeekCount) {
            prevWeekCount = wc;
            controller.enqueue(
              sseEvent("progress", {
                weeks_generated: wc,
                current_week_focus: partial.weeks?.at(-1)?.focus ?? null,
              }),
            );
          }
        }

        const final = await result.object;

        const { data: inserted, error: insertErr } = await supabase
          .from("training_programs")
          .insert({
            user_id: user.id,
            name: final.name,
            description: final.description,
            goal,
            weeks,
            days_per_week,
            status: "draft",
            is_public: true,
            program_data: final,
          })
          .select("id")
          .single();

        if (insertErr || !inserted) {
          logger.error("Program insert error:", insertErr);
          controller.enqueue(sseEvent("error", { error: "Failed to save program" }));
        } else {
          controller.enqueue(sseEvent("done", { program_id: inserted.id }));
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error("Program builder stream error:", errMsg, error);
        controller.enqueue(sseEvent("error", { error: `Stream failed: ${errMsg}` }));
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
}
