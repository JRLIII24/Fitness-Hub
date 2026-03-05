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
    .select("target_calories, target_protein_g, target_carbs_g, target_fat_g")
    .eq("user_id", user.id)
    .single();

  // Sum today's food log entries
  const { data: logs } = await supabase
    .from("food_log")
    .select("calories, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .eq("logged_date", today);

  const consumed = (logs ?? []).reduce(
    (acc, row) => ({
      calories: acc.calories + (row.calories ?? 0),
      protein: acc.protein + (row.protein_g ?? 0),
      carbs: acc.carbs + (row.carbs_g ?? 0),
      fat: acc.fat + (row.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return NextResponse.json({
    target_calories: goals?.target_calories ?? null,
    consumed_calories: Math.round(consumed.calories),
    target_protein: goals?.target_protein_g ?? null,
    consumed_protein: Math.round(consumed.protein),
    target_carbs: goals?.target_carbs_g ?? null,
    consumed_carbs: Math.round(consumed.carbs),
    target_fat: goals?.target_fat_g ?? null,
    consumed_fat: Math.round(consumed.fat),
  });
}
