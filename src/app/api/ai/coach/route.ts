/**
 * AI Coach Chat API
 * POST /api/ai/coach
 *
 * Unified coach endpoint — replaces suggest, recovery,
 * progress-insight, nutrition-advice routes.
 *
 * Model: Sonnet (multi-turn reasoning)
 * Rate limit: 30/day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  getAnthropicClient,
  ANTHROPIC_SONNET,
} from "@/lib/anthropic-client";
import { callAnthropicWithTool } from "@/lib/anthropic-helper";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai-prompts/coach";
import {
  CoachResponseSchema,
  type CoachRequest,
  type CoachResponse,
} from "@/lib/coach/types";

const DAILY_LIMIT = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: {
      type: "string",
      maxLength: 2000,
      description: "Your conversational reply. Always confirm actions you took.",
    },
    action: {
      type: "string",
      enum: [
        "show_exercise_history",
        "generate_workout",
        "show_substitution",
        "show_readiness",
        "show_recovery",
        "show_prescription",
        "add_exercise",
        "swap_exercise",
        "add_sets",
        "update_set",
        "remove_exercise",
        "create_and_add_exercise",
        "start_timer",
        "create_template",
        "start_workout_from_template",
        "navigate_to",
        "none",
      ],
      description: "The action to take. Mutation actions modify the workout directly. Use navigate_to to route the user to a different screen in the app.",
    },
    data: {
      type: "object",
      description:
        "Action payload. Shape depends on action type. For add_exercise: {exercise_name, muscle_group, sets?}. For add_sets: {exercise_name, sets: [{weight_kg, reps}]}. For swap_exercise: {current_exercise_name, new_exercise_name, new_muscle_group, reason}. For create_and_add_exercise: {exercise_name, muscle_group, equipment, category, sets?}. For start_timer: {seconds}. For update_set: {exercise_name, set_number, updates}. For remove_exercise: {exercise_name, reason}. For create_template: {template_name, primary_muscle_group, exercises: [{exercise_name, muscle_group, target_sets, target_reps, rest_seconds?, equipment?, category?}]}. For start_workout_from_template: {template_id, template_name}. For navigate_to: {screen} where screen is one of: dashboard, workout, nutrition, history, body, marketplace, pods, exercises, settings.",
      additionalProperties: true,
      nullable: true,
    },
  },
  required: ["reply", "action"],
};

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
      `ai:coach:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = (await request.json()) as CoachRequest;
    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

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

    const result = await callAnthropicWithTool<CoachResponse>({
      client,
      model: ANTHROPIC_SONNET,
      systemPrompt: COACH_SYSTEM_PROMPT,
      messages,
      toolName: "coach_response",
      toolDescription:
        "Respond to the user and optionally take an action on their workout. For mutation actions (add_exercise, add_sets, swap_exercise, etc.), include the required data payload.",
      toolSchema: TOOL_SCHEMA,
      zodSchema: CoachResponseSchema,
      maxTokens: 2048,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error("Coach API error:", error);
    return NextResponse.json(
      { error: "Failed to process coach request" },
      { status: 500 },
    );
  }
}
