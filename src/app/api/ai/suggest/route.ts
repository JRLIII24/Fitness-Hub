/**
 * AI Workout Suggestion API
 * GET /api/ai/suggest - Get AI-enriched workout coaching note
 *
 * This endpoint augments the pattern-based launcher with AI reasoning.
 * It is non-blocking — the core launcher prediction always returns first.
 * Rate limited to 5 calls per user per day to control API costs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";

export interface AISuggestion {
  reasoning: string;
  muscle_focus: string;
  intensity_recommendation: "high" | "moderate" | "recovery";
  coaching_note: string;
}

const DAILY_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const ai = getAIClient();
    if (!ai) return NextResponse.json(null);

    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const allowed = await rateLimit(`ai:suggest:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: recentSessions }, { data: profile }] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select(
          `id, started_at, total_volume_kg,
           workout_sets (exercise_id, exercises (name, muscle_group))`
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("started_at", sevenDaysAgo)
        .order("started_at", { ascending: false })
        .limit(7),
      supabase
        .from("profiles")
        .select("fitness_goal, current_streak, xp, level")
        .eq("id", user.id)
        .single(),
    ]);

    const muscleFrequency: Record<string, number> = {};
    (recentSessions ?? []).forEach((session) => {
      const sets = (session.workout_sets as unknown) as Array<{
        exercises: { muscle_group: string } | { muscle_group: string }[] | null;
      }> | null;
      (sets ?? []).forEach((set) => {
        const ex = set.exercises;
        const mg = Array.isArray(ex) ? ex[0]?.muscle_group : ex?.muscle_group;
        if (mg) muscleFrequency[mg] = (muscleFrequency[mg] ?? 0) + 1;
      });
    });

    const now = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const timeOfDay =
      now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";

    const contextSummary = [
      `Day: ${dayNames[now.getDay()]}, ${timeOfDay}`,
      `User level: ${profile?.level ?? 1}, streak: ${profile?.current_streak ?? 0} days`,
      `Fitness goal: ${profile?.fitness_goal ?? "general fitness"}`,
      `Sessions this week: ${recentSessions?.length ?? 0}`,
      `Muscle groups trained this week: ${
        Object.entries(muscleFrequency)
          .sort(([, a], [, b]) => b - a)
          .map(([mg, count]) => `${mg} (${count} sets)`)
          .join(", ") || "none yet"
      }`,
    ].join("\n");

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a concise, evidence-based fitness coach.
Given a user's training context, provide today's coaching note.
Base your answer on muscle balance, recovery needs, and training frequency. Be direct.
Respond with JSON containing exactly these fields:
- reasoning: 1 sentence on why this workout makes sense today
- muscle_focus: primary muscle group to target (one word)
- intensity_recommendation: "high", "moderate", or "recovery"
- coaching_note: 1 short motivational or tactical tip (max 12 words)`,
        },
        {
          role: "user",
          content: `User training context:\n${contextSummary}\n\nProvide today's coaching note.`,
        },
      ],
    });

    const suggestion = JSON.parse(completion.choices[0].message.content ?? "null") as AISuggestion;
    return NextResponse.json(suggestion);
  } catch (error) {
    logger.error("AI suggest error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }
    return NextResponse.json(null);
  }
}
