/**
 * AI Nutrition Advisor API
 * GET /api/ai/nutrition-advice - Analyze today's food log and weekly patterns
 *
 * Non-blocking — the caller renders the card only when data arrives.
 * Rate limited to 5 calls per user per day.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";

export interface AINutritionAdvice {
  macro_balance: "good" | "low_protein" | "high_carb" | "caloric_surplus" | "caloric_deficit";
  top_tip: string;
  meal_suggestion: string;
  weekly_pattern: string;
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

    const allowed = await rateLimit(`ai:nutrition:${user.id}`, DAILY_LIMIT, ONE_DAY_MS);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = todayStart.toISOString().slice(0, 10);

    const [todayResult, weekResult, goalResult, profileResult] = await Promise.all([
      supabase
        .from("food_log")
        .select("calories_consumed, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .gte("logged_at", todayStart.toISOString())
        .lt("logged_at", todayEnd.toISOString()),
      supabase
        .from("food_log")
        .select("calories_consumed, protein_g, carbs_g, fat_g, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", sevenDaysAgo)
        .lt("logged_at", todayStart.toISOString()),
      supabase
        .from("nutrition_goals")
        .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
        .eq("user_id", user.id)
        .lte("effective_from", todayStr)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("fitness_goal")
        .eq("id", user.id)
        .single(),
    ]);

    type FoodRow = { calories_consumed: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null };

    const todayEntries = (todayResult.data ?? []) as FoodRow[];
    const weekEntries = (weekResult.data ?? []) as (FoodRow & { logged_at: string })[];
    const goal = goalResult.data as {
      calories_target: number | null;
      protein_g_target: number | null;
      carbs_g_target: number | null;
      fat_g_target: number | null;
    } | null;
    const profile = profileResult.data as { fitness_goal: string | null } | null;

    const todayTotals = todayEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories_consumed ?? 0),
        protein: acc.protein + (e.protein_g ?? 0),
        carbs: acc.carbs + (e.carbs_g ?? 0),
        fat: acc.fat + (e.fat_g ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const dayMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const e of weekEntries) {
      const day = e.logged_at.slice(0, 10);
      const cur = dayMap.get(day) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
      dayMap.set(day, {
        calories: cur.calories + (e.calories_consumed ?? 0),
        protein: cur.protein + (e.protein_g ?? 0),
        carbs: cur.carbs + (e.carbs_g ?? 0),
        fat: cur.fat + (e.fat_g ?? 0),
      });
    }
    const dayCount = dayMap.size || 1;
    const weeklyAvg = [...dayMap.values()].reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories / dayCount,
        protein: acc.protein + d.protein / dayCount,
        carbs: acc.carbs + d.carbs / dayCount,
        fat: acc.fat + d.fat / dayCount,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const contextSummary = [
      `Fitness goal: ${profile?.fitness_goal ?? "general fitness"}`,
      `Today — Calories: ${Math.round(todayTotals.calories)}, Protein: ${Math.round(todayTotals.protein)}g, Carbs: ${Math.round(todayTotals.carbs)}g, Fat: ${Math.round(todayTotals.fat)}g`,
      goal
        ? `Daily goals — Calories: ${goal.calories_target ?? "?"}kcal, Protein: ${goal.protein_g_target ?? "?"}g, Carbs: ${goal.carbs_g_target ?? "?"}g, Fat: ${goal.fat_g_target ?? "?"}g`
        : "No nutrition goals set",
      `7-day avg (excl. today) — Calories: ${Math.round(weeklyAvg.calories)}, Protein: ${Math.round(weeklyAvg.protein)}g, Carbs: ${Math.round(weeklyAvg.carbs)}g, Fat: ${Math.round(weeklyAvg.fat)}g`,
      `Days logged in past week: ${dayMap.size}`,
    ].join("\n");

    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a concise sports nutritionist.
Given a user's nutrition data for today and the past week, provide nutrition advice.
Be specific, practical, and encouraging.
Respond with JSON containing exactly these fields:
- macro_balance: "good", "low_protein", "high_carb", "caloric_surplus", or "caloric_deficit"
- top_tip: one short, actionable nutrition tip based on their data (max 20 words)
- meal_suggestion: one specific meal or food suggestion for today (max 15 words)
- weekly_pattern: one observation about their weekly eating pattern (max 20 words)`,
        },
        {
          role: "user",
          content: `User nutrition context:\n${contextSummary}\n\nProvide nutrition advice.`,
        },
      ],
    });

    const advice = JSON.parse(completion.choices[0].message.content ?? "null") as AINutritionAdvice;
    return NextResponse.json(advice);
  } catch (error) {
    logger.error("AI nutrition-advice error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }
    return NextResponse.json(null);
  }
}
