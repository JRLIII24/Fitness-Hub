/**
 * Voice Intent Classification API
 * POST /api/ai/voice-intent
 *
 * Classifies speech transcripts into workout intents.
 * Tries regex first for timer commands, falls back to Haiku.
 *
 * Model: Haiku (fast classification)
 * Rate limit: 100/day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  getAnthropicClient,
  ANTHROPIC_HAIKU,
} from "@/lib/anthropic-client";
import { callAnthropicWithTool } from "@/lib/anthropic-helper";
import { VOICE_INTENT_PROMPT } from "@/lib/ai-prompts/voice-intent";
import { VoiceIntentSchema, type VoiceIntent } from "@/lib/coach/types";

const DAILY_LIMIT = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    type: {
      type: "string",
      enum: [
        "log_set",
        "start_timer",
        "stop_timer",
        "swap_exercise",
        "ask_coach",
        "unknown",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    parsed_data: {
      type: "object",
      nullable: true,
      properties: {
        sets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              weight: { type: "number", nullable: true },
              reps: { type: "number", nullable: true },
              unit: { type: "string", enum: ["kg", "lbs"], nullable: true },
              set_type: {
                type: "string",
                enum: ["warmup", "working", "dropset", "failure"],
                nullable: true,
              },
              rpe: { type: "number", nullable: true },
              rir: { type: "number", nullable: true },
              notes: { type: "string", nullable: true },
            },
          },
        },
        timer_seconds: { type: "number" },
        exercise_name: { type: "string" },
        coach_query: { type: "string" },
      },
    },
  },
  required: ["type", "confidence"],
};

/**
 * Try to parse timer commands locally via regex.
 * Returns VoiceIntent if matched, null otherwise.
 */
function tryParseTimerLocally(transcript: string): VoiceIntent | null {
  const t = transcript.toLowerCase().trim();

  // "stop timer", "cancel timer", "cancel rest"
  if (/\b(stop|cancel)\s*(timer|rest|the timer)\b/.test(t)) {
    return {
      type: "stop_timer",
      confidence: 0.95,
      parsed_data: null,
    };
  }

  // "90 second rest", "rest 2 minutes", "start 60 second timer"
  const timerPatterns = [
    /(\d+)\s*(?:second|sec|s)\s*(?:rest|timer|break)/i,
    /(?:rest|timer|break)\s*(?:for\s*)?(\d+)\s*(?:second|sec|s)/i,
    /(\d+)\s*(?:minute|min|m)\s*(?:rest|timer|break)/i,
    /(?:rest|timer|break)\s*(?:for\s*)?(\d+)\s*(?:minute|min|m)/i,
    /(?:start|set)\s*(?:a\s*)?(\d+)\s*(?:second|sec|s)/i,
    /(?:start|set)\s*(?:a\s*)?(\d+)\s*(?:minute|min|m)/i,
  ];

  for (let i = 0; i < timerPatterns.length; i++) {
    const match = t.match(timerPatterns[i]);
    if (match) {
      const value = parseInt(match[1], 10);
      // Patterns at indices 2, 3, 5 are minute patterns
      const isMinutes = i === 2 || i === 3 || i === 5;
      const seconds = isMinutes ? value * 60 : value;

      if (seconds > 0 && seconds <= 600) {
        return {
          type: "start_timer",
          confidence: 0.95,
          parsed_data: { timer_seconds: seconds },
        };
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transcript: string | undefined = body?.transcript;
    const hasActiveWorkout: boolean = body?.has_active_workout ?? false;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 },
      );
    }

    // Try local regex first for timer commands (no API call needed)
    const localResult = tryParseTimerLocally(transcript);
    if (localResult) {
      return NextResponse.json(localResult);
    }

    const client = getAnthropicClient();
    if (!client) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(
      `ai:voice:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const result = await callAnthropicWithTool<VoiceIntent>({
      client,
      model: ANTHROPIC_HAIKU,
      systemPrompt: VOICE_INTENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcript: "${transcript}"\nhas_active_workout: ${hasActiveWorkout}`,
        },
      ],
      toolName: "classify_intent",
      toolDescription:
        "Classify the voice command and extract relevant data",
      toolSchema: TOOL_SCHEMA,
      zodSchema: VoiceIntentSchema,
      maxTokens: 512,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error("Voice intent API error:", error);
    return NextResponse.json(
      { error: "Failed to classify voice command" },
      { status: 500 },
    );
  }
}
