/**
 * AI Onboarding Coach API
 * POST /api/ai/onboarding-coach
 *
 * Guides new users through goal-setting and generates a personalized
 * nutrition plan (calories + macros) based on their body stats.
 *
 * Model: Haiku (fast, cheap — simple goal-setting conversation)
 * Rate limit: 10/day
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai-prompts/onboarding";
import { kgToLbs } from "@/lib/units";

const DAILY_LIMIT = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const PlanDataSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  fitness_goal: z.enum([
    "build_muscle",
    "lose_weight",
    "maintain",
    "improve_endurance",
  ]),
  rationale: z.string(),
});

const OnboardingCoachResponseSchema = z.object({
  reply: z.string(),
  action: z.enum(["ask_question", "generate_plan"]),
  plan_data: PlanDataSchema.optional().nullable(),
});

type OnboardingCoachResponse = z.infer<typeof OnboardingCoachResponseSchema>;

interface OnboardingCoachRequest {
  message: string;
  conversation_history?: Array<{ role: string; content: string }>;
  user_stats: {
    height_cm: number;
    weight_kg: number;
    goal_weight_kg: number | null;
    age: number;
    gender: string;
    activity_level: string;
    unit_preference: 'metric' | 'imperial';
  };
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

    const allowed = await rateLimit(
      `ai:onboarding:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = (await request.json()) as OnboardingCoachRequest;
    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    // Build conversation messages
    const s = body.user_stats;
    const statsContext = s
      ? (() => {
          const isImperial = s.unit_preference === 'imperial';
          const weightDisplay = isImperial
            ? `${Math.round(kgToLbs(s.weight_kg))} lb`
            : `${s.weight_kg} kg`;
          const goalDisplay = s.goal_weight_kg != null
            ? isImperial
              ? `${Math.round(kgToLbs(s.goal_weight_kg))} lb`
              : `${s.goal_weight_kg} kg`
            : 'not set';
          const heightDisplay = isImperial
            ? `${Math.floor(s.height_cm / 30.48)}ft ${Math.round((s.height_cm / 2.54) % 12)}in`
            : `${s.height_cm} cm`;
          return `\n\n---\nUser stats (display unit: ${s.unit_preference}): Height ${heightDisplay}, Current weight ${weightDisplay}, Goal weight ${goalDisplay}, Age ${s.age}, Gender: ${s.gender}, Activity: ${s.activity_level}.\nNOTE: The user's preferred unit is ${isImperial ? 'lbs/inches' : 'kg/cm'}. When the user states a target weight or change, interpret it in that unit unless they specify otherwise. All plan_data macros must be in grams.`;
        })()
      : "";

    const messages = [
      ...(body.conversation_history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `${body.message}${statsContext}`,
      },
    ];

    const { object } = await generateObject({
      model: provider(HAIKU),
      schema: OnboardingCoachResponseSchema,
      system: ONBOARDING_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 1024,
    });

    return NextResponse.json(object);
  } catch (error) {
    logger.error("Onboarding coach API error:", error);
    return NextResponse.json(
      { error: "Failed to process onboarding request" },
      { status: 500 },
    );
  }
}
