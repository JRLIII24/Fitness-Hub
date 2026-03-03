/**
 * AI Progress Insight API
 * GET /api/ai/progress-insight - Analyze 90-day workout trend and return coaching insights
 *
 * Non-blocking — the caller renders the card only when data arrives.
 * Rate limited to 3 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";

export interface AIProgressInsight {
  strength_trend: "improving" | "plateau" | "declining";
  top_achievement: string;
  focus_suggestion: string;
  volume_insight: string;
  motivational_note: string;
}

const DAILY_LIMIT = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Return the ISO week string (YYYY-Www) for a given date string */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const ai = getAIClient();
    if (!ai) return NextResponse.json(null);

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:progress:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const sessionsQuery = supabase
      .from("workout_sessions")
      .select("started_at, total_volume_kg")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", ninetyDaysAgo)
      .order("started_at", { ascending: true })
      .limit(90);

    const profileQuery = supabase
      .from("profiles")
      .select("level, current_streak, fitness_goal")
      .eq("id", user.id)
      .single();

    const [sessionsResult, profileResult] = await Promise.all([
      sessionsQuery,
      profileQuery,
    ]);

    const sessions = (sessionsResult.data ?? []) as Array<{
      started_at: string;
      total_volume_kg: number | null;
    }>;
    const profile = profileResult.data as {
      level: number;
      current_streak: number;
      fitness_goal: string | null;
    } | null;
    const weekMap = new Map<string, number>();
    for (const s of sessions) {
      const week = isoWeek(s.started_at);
      weekMap.set(week, (weekMap.get(week) ?? 0) + (s.total_volume_kg ?? 0));
    }
    const weeklyVolumes = [...weekMap.values()];
    const recent4 = weeklyVolumes.slice(-4);
    const prior4 = weeklyVolumes.slice(-8, -4);
    const recentAvg = recent4.length ? recent4.reduce((a, b) => a + b, 0) / recent4.length : 0;
    const priorAvg = prior4.length ? prior4.reduce((a, b) => a + b, 0) / prior4.length : 0;

    const trend =
      priorAvg > 0
        ? (recentAvg - priorAvg) / priorAvg
        : 0;

    const trendLabel =
      trend > 0.05 ? "improving" : trend < -0.05 ? "declining" : "plateau";

    const peakVolume = Math.round(Math.max(0, ...sessions.map((s) => s.total_volume_kg ?? 0)));
    const totalSessions = sessions.length;
    const contextSummary = [
      `User level: ${profile?.level ?? 1}, streak: ${profile?.current_streak ?? 0} days`,
      `Fitness goal: ${profile?.fitness_goal ?? "general fitness"}`,
      `Sessions in last 90 days: ${totalSessions}`,
      `Weekly volume trend (recent 4-week avg vs prior): ${trendLabel} (${Math.round(trend * 100)}%)`,
      `Peak session volume (kg): ${peakVolume}`,
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a concise, evidence-based strength and fitness coach.
Given a user's 90-day training data, provide a progress insight.
Be specific, grounded in the data, and direct.
Respond with JSON containing exactly these fields:
- strength_trend: "improving", "plateau", or "declining"
- top_achievement: one short sentence about the user's best result
- focus_suggestion: one short sentence on what to prioritize next
- volume_insight: one short observation about volume patterns
- motivational_note: one short motivational sentence (max 15 words)`,
        },
        {
          role: "user",
          content: `User training context:\n${contextSummary}\n\nProvide a progress insight.`,
        },
      ],
    });

    const insight = JSON.parse(completion.choices[0].message.content ?? "null") as AIProgressInsight;
    return NextResponse.json(insight);
  } catch (error) {
    logger.error("AI progress-insight error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }
    return NextResponse.json(null);
  }
}
