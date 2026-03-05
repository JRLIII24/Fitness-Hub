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
import {
  getAnthropicClient,
  ANTHROPIC_HAIKU,
} from "@/lib/anthropic-client";
import { callAnthropicWithTool } from "@/lib/anthropic-helper";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai-prompts/onboarding";

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
  reply: z.string().max(2000),
  action: z.enum(["ask_question", "generate_plan"]),
  plan_data: PlanDataSchema.optional().nullable(),
});

type OnboardingCoachResponse = z.infer<typeof OnboardingCoachResponseSchema>;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: {
      type: "string",
      maxLength: 2000,
      description: "Your conversational reply to the user.",
    },
    action: {
      type: "string",
      enum: ["ask_question", "generate_plan"],
      description:
        "ask_question = continue conversation, generate_plan = return final nutrition plan with plan_data.",
    },
    plan_data: {
      type: "object",
      nullable: true,
      description:
        "Required when action is generate_plan. Contains the calculated nutrition targets.",
      properties: {
        calories: { type: "number", description: "Daily calorie target" },
        protein_g: { type: "number", description: "Daily protein in grams" },
        carbs_g: { type: "number", description: "Daily carbs in grams" },
        fat_g: { type: "number", description: "Daily fat in grams" },
        fiber_g: { type: "number", description: "Daily fiber in grams" },
        fitness_goal: {
          type: "string",
          enum: ["build_muscle", "lose_weight", "maintain", "improve_endurance"],
          description: "The user's chosen fitness goal",
        },
        rationale: {
          type: "string",
          description: "Brief explanation of the calculation approach",
        },
      },
      required: [
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fiber_g",
        "fitness_goal",
        "rationale",
      ],
    },
  },
  required: ["reply", "action"],
};

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
    const client = getAnthropicClient();
    if (!client) {
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
            ? `${Math.round(s.weight_kg * 2.20462)} lb`
            : `${s.weight_kg} kg`;
          const goalDisplay = s.goal_weight_kg != null
            ? isImperial
              ? `${Math.round(s.goal_weight_kg * 2.20462)} lb`
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

    const result = await callAnthropicWithTool<OnboardingCoachResponse>({
      client,
      model: ANTHROPIC_HAIKU,
      systemPrompt: ONBOARDING_SYSTEM_PROMPT,
      messages,
      toolName: "onboarding_response",
      toolDescription:
        "Respond to the user during onboarding. Use ask_question to continue the conversation, or generate_plan to finalize their nutrition plan with calculated targets.",
      toolSchema: TOOL_SCHEMA,
      zodSchema: OnboardingCoachResponseSchema,
      maxTokens: 1024,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error("Onboarding coach API error:", error);
    return NextResponse.json(
      { error: "Failed to process onboarding request" },
      { status: 500 },
    );
  }
}
