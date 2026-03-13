/**
 * Plan Swap Suggestions API
 * POST /api/ai/plan-swap
 *
 * Returns 3-4 AI-suggested exercise alternatives for the workout plan preview.
 * Falls back to DB muscle-group query if AI is unavailable.
 *
 * Model: Haiku (fast)
 * Rate limit: 60/day
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { PLAN_SWAP_PROMPT } from "@/lib/ai-prompts/plan-swap";

const DAILY_LIMIT = 60;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const SwapSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string().describe("Exercise name"),
      rationale: z.string().describe("Brief reason this is a good swap"),
    })
  ).min(3).max(4),
});

export type SwapSuggestion = z.infer<typeof SwapSuggestionSchema>["suggestions"][number];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const exerciseName: string | undefined = body?.exercise_name;
    const muscleGroup: string | undefined = body?.muscle_group;
    const existingExercises: string[] = body?.existing_exercises ?? [];
    const equipment: string | undefined = body?.equipment;

    if (!exerciseName || !muscleGroup) {
      return NextResponse.json(
        { error: "exercise_name and muscle_group are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Try AI first
    const provider = getAnthropicProvider();
    if (provider) {
      const allowed = await rateLimit(
        `ai:plan-swap:${user.id}`,
        DAILY_LIMIT,
        ONE_DAY_MS,
      );

      if (allowed) {
        try {
          const { object } = await generateObject({
            model: provider(HAIKU),
            schema: SwapSuggestionSchema,
            system: PLAN_SWAP_PROMPT,
            prompt: [
              `Exercise to replace: "${exerciseName}" (muscle group: ${muscleGroup})`,
              equipment ? `Available equipment: ${equipment}` : "",
              existingExercises.length > 0
                ? `Already in workout (avoid these): ${existingExercises.join(", ")}`
                : "",
            ].filter(Boolean).join("\n"),
            maxOutputTokens: 512,
          });

          return NextResponse.json(object);
        } catch {
          // Fall through to DB fallback
        }
      }
    }

    // Fallback: query exercises from DB by muscle group
    const { data: candidates } = await supabase
      .from("exercises")
      .select("name")
      .eq("muscle_group", muscleGroup as any)
      .eq("is_custom", false)
      .neq("name", exerciseName)
      .limit(10);

    const filtered = (candidates ?? [])
      .filter((c) => !existingExercises.includes(c.name))
      .slice(0, 4);

    return NextResponse.json({
      suggestions: filtered.map((c) => ({
        name: c.name,
        rationale: `Targets ${muscleGroup}`,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
