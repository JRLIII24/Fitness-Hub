/**
 * AI Workout Recap API
 * POST /api/ai/workout-recap
 *
 * Generates a short AI recap of a completed workout session,
 * comparing it to recent history and highlighting PRs.
 *
 * Model: Haiku (fast summary)
 * Rate limit: 20/day
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { generateObject } from "ai";
import { getAnthropicProvider, HAIKU } from "@/lib/ai-sdk";
import { WORKOUT_RECAP_SYSTEM_PROMPT } from "@/lib/ai-prompts/workout-recap";
import { z } from "zod";

const DAILY_LIMIT = 20;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// NOTE: No .min()/.max() — Anthropic rejects these in structured output schemas.
const RecapSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  improvement_tip: z.string(),
  volume_trend: z.enum(["up", "down", "stable"]),
});

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
      `ai:workout-recap:${user.id}`,
      DAILY_LIMIT,
      ONE_DAY_MS,
    );
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const sessionId = body?.session_id;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 },
      );
    }

    // Fetch current session with sets and exercises
    const { data: session } = await supabase
      .from("workout_sessions")
      .select("id, name, total_volume_kg, duration_seconds, completed_at, started_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("exercise_id, set_number, weight_kg, reps, set_type, completed_at")
      .eq("session_id", sessionId)
      .not("completed_at", "is", null)
      .order("sort_order", { ascending: true });

    // Fetch exercise names for sets
    const exerciseIds = [...new Set((sets ?? []).map((s) => s.exercise_id))];
    const { data: exercises } = exerciseIds.length > 0
      ? await supabase
          .from("exercises")
          .select("id, name, muscle_group")
          .in("id", exerciseIds)
      : { data: [] };

    const exerciseMap = new Map(
      (exercises ?? []).map((e) => [e.id, e]),
    );

    // Build exercise summary for this session
    const exerciseSummary = exerciseIds.map((id) => {
      const ex = exerciseMap.get(id);
      const exSets = (sets ?? []).filter((s) => s.exercise_id === id);
      return {
        name: ex?.name ?? "Unknown",
        muscle_group: ex?.muscle_group ?? "unknown",
        sets: exSets.map((s) => ({
          weight_kg: s.weight_kg,
          reps: s.reps,
          set_type: s.set_type,
        })),
      };
    });

    // Fetch last 5 completed sessions for comparison
    const { data: recentSessions } = await supabase
      .from("workout_sessions")
      .select("id, name, total_volume_kg, duration_seconds, completed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .neq("id", sessionId)
      .order("completed_at", { ascending: false })
      .limit(5);

    const recentAvgVolume =
      (recentSessions ?? []).length > 0
        ? (recentSessions ?? []).reduce(
            (sum, s) => sum + (s.total_volume_kg ?? 0),
            0,
          ) / (recentSessions ?? []).length
        : null;

    // Find PRs: for each exercise in this session, check if any set beat all-time best
    const prInfo: string[] = [];
    for (const exId of exerciseIds) {
      const exName = exerciseMap.get(exId)?.name ?? "Unknown";
      const sessionBest = (sets ?? [])
        .filter((s) => s.exercise_id === exId && s.weight_kg && s.reps)
        .reduce<{ weight_kg: number; reps: number } | null>((best, s) => {
          const score = (s.weight_kg ?? 0) * (s.reps ?? 0);
          const bestScore = best ? best.weight_kg * best.reps : 0;
          return score > bestScore ? { weight_kg: s.weight_kg!, reps: s.reps! } : best;
        }, null);

      if (!sessionBest) continue;

      // Check historical best for this exercise
      const { data: histBest } = await supabase
        .from("workout_sets")
        .select("weight_kg, reps")
        .eq("exercise_id", exId)
        .not("completed_at", "is", null)
        .not("weight_kg", "is", null)
        .not("reps", "is", null)
        .neq("session_id", sessionId)
        .order("weight_kg", { ascending: false })
        .limit(20);

      const historicalBestScore = (histBest ?? []).reduce((best, s) => {
        const score = (s.weight_kg ?? 0) * (s.reps ?? 0);
        return score > best ? score : best;
      }, 0);

      if (sessionBest.weight_kg * sessionBest.reps > historicalBestScore) {
        prInfo.push(`${exName}: ${sessionBest.weight_kg} kg × ${sessionBest.reps}`);
      }
    }

    // Build message for AI
    const contextMessage = JSON.stringify({
      session: {
        name: session.name,
        total_volume_kg: session.total_volume_kg,
        duration_seconds: session.duration_seconds,
        exercises: exerciseSummary,
      },
      prs: prInfo.length > 0 ? prInfo : null,
      recent_sessions: {
        count: (recentSessions ?? []).length,
        avg_volume_kg: recentAvgVolume ? Number(recentAvgVolume.toFixed(1)) : null,
        sessions: (recentSessions ?? []).map((s) => ({
          name: s.name,
          volume_kg: s.total_volume_kg,
          duration_seconds: s.duration_seconds,
        })),
      },
    });

    const { object } = await generateObject({
      model: provider(HAIKU),
      schema: RecapSchema,
      system: WORKOUT_RECAP_SYSTEM_PROMPT,
      prompt: `Generate a workout recap for this session:\n\n${contextMessage}`,
      maxOutputTokens: 512,
    });

    return NextResponse.json({ recap: object });
  } catch (error) {
    logger.error("Workout recap API error:", error);
    return NextResponse.json(
      { error: "Failed to generate recap" },
      { status: 500 },
    );
  }
}
