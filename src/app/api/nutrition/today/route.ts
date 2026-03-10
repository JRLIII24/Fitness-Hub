/**
 * GET /api/nutrition/today
 *
 * Returns today's macro consumption vs targets for the coach context.
 * Lightweight — used by CoachFabWrapper to hydrate CoachContext.daily_macros.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { getUserTimezone, getDayBoundaries } from "@/lib/timezone";

export async function GET() {
  const supabase = await createClient();
  const { user, response: authErr } = await requireAuth(supabase);
  if (authErr) return authErr;

  const timezone = await getUserTimezone(user.id);
  const { todayStr: today } = getDayBoundaries(timezone);

  // Fetch nutrition goals
  const { data: goals } = await supabase
    .from("nutrition_goals")
    .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
    .eq("user_id", user.id)
    .single();

  // Sum today's food log entries (filter by logged_at date)
  const { data: logs } = await supabase
    .from("food_log")
    .select("calories_consumed, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .gte("logged_at", `${today}T00:00:00`)
    .lt("logged_at", `${today}T23:59:59.999`);

  const consumed = (logs ?? []).reduce(
    (acc, row) => ({
      calories: acc.calories + (row.calories_consumed ?? 0),
      protein: acc.protein + (row.protein_g ?? 0),
      carbs: acc.carbs + (row.carbs_g ?? 0),
      fat: acc.fat + (row.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return NextResponse.json({
    target_calories: goals?.calories_target ?? null,
    consumed_calories: Math.round(consumed.calories),
    target_protein: goals?.protein_g_target ?? null,
    consumed_protein: Math.round(consumed.protein),
    target_carbs: goals?.carbs_g_target ?? null,
    consumed_carbs: Math.round(consumed.carbs),
    target_fat: goals?.fat_g_target ?? null,
    consumed_fat: Math.round(consumed.fat),
  });
}
