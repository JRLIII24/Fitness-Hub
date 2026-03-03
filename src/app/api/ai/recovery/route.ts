/**
 * AI Recovery Advisor API
 * GET /api/ai/recovery - Analyze fatigue snapshot and recent muscle load for recovery advice
 *
 * Non-blocking — the caller renders the card only when data arrives.
 * Rate limited to 3 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";

export interface AIRecoveryAdvice {
  recovery_status: "fresh" | "moderate" | "fatigued" | "overtrained";
  recommended_action: "train" | "active_recovery" | "full_rest";
  recovery_tip: string;
  tomorrow_suggestion: string;
}

const DAILY_LIMIT = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const ai = getAIClient();
    if (!ai) return NextResponse.json(null);

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:recovery:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [fatigueSnapshot, muscleResult, profileResult] = await Promise.all([
      getCachedOrComputeFatigueSnapshot(user.id),
      supabase
        .from("workout_sets")
        .select("exercises!inner(muscle_group), workout_sessions!inner(started_at, status)")
        .eq("workout_sessions.user_id", user.id)
        .eq("workout_sessions.status", "completed")
        .gte("workout_sessions.started_at", sevenDaysAgo),
      supabase
        .from("profiles")
        .select("current_streak, fitness_goal")
        .eq("id", user.id)
        .single(),
    ]);

    const profile = profileResult.data as {
      current_streak: number;
      fitness_goal: string | null;
    } | null;

    const muscleCount: Record<string, number> = {};
    const sets = (muscleResult.data ?? []) as Array<{
      exercises: { muscle_group: string } | { muscle_group: string }[] | null;
    }>;
    for (const s of sets) {
      const ex = s.exercises;
      const mg = Array.isArray(ex) ? ex[0]?.muscle_group : ex?.muscle_group;
      if (mg) muscleCount[mg] = (muscleCount[mg] ?? 0) + 1;
    }
    const topMuscles = Object.entries(muscleCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([mg, count]) => `${mg} (${count} sets)`)
      .join(", ") || "none";

    const snap = fatigueSnapshot;

    const contextSummary = [
      `Fitness goal: ${profile?.fitness_goal ?? "general fitness"}`,
      `Current streak: ${profile?.current_streak ?? 0} days`,
      `Fatigue score: ${Math.round(snap.fatigueScore)}/100 (${snap.recommendation.label})`,
      `Load subscore: ${Math.round(snap.loadSubscore)}, Recovery subscore: ${Math.round(snap.recoverySubscore)}, Performance subscore: ${Math.round(snap.performanceSubscore)}`,
      `Recommendation: ${snap.recommendation.guidance}`,
      snap.metadata.strain != null ? `Today's strain index: ${Math.round((snap.metadata.strain ?? 0) * 100) / 100}` : null,
      `Top muscles trained (last 7 days): ${topMuscles}`,
      `Has recovery check-in today: ${snap.hasRecoveryCheckin}`,
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a concise sports recovery specialist.
Given a user's fatigue and training data, provide recovery advice.
Base recovery_status on the fatigue score: 0-30=fresh, 31-55=moderate, 56-75=fatigued, 76+=overtrained.
Be direct and practical.
Respond with JSON containing exactly these fields:
- recovery_status: "fresh", "moderate", "fatigued", or "overtrained"
- recommended_action: "train", "active_recovery", or "full_rest"
- recovery_tip: one specific recovery action for today (max 18 words)
- tomorrow_suggestion: one suggestion for tomorrow's training or rest (max 15 words)`,
        },
        {
          role: "user",
          content: `User recovery context:\n${contextSummary}\n\nProvide recovery advice.`,
        },
      ],
    });

    const advice = JSON.parse(completion.choices[0].message.content ?? "null") as AIRecoveryAdvice;
    return NextResponse.json(advice);
  } catch (error) {
    logger.error("AI recovery error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }
    return NextResponse.json(null);
  }
}
