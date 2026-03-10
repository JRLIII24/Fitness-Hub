import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface NutritionTrendDay {
  day: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_count: number;
}

export interface NutritionTrendsGoals {
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
}

export interface NutritionTrendsResponse {
  days: NutritionTrendDay[];
  goals: NutritionTrendsGoals | null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawPeriod = parseInt(searchParams.get("period") ?? "30", 10);
  const period = isNaN(rawPeriod) || rawPeriod < 1 ? 30 : Math.min(rawPeriod, 90);

  // Fetch daily nutrition trends from RPC
  const { data: trendRows, error: trendError } = await (supabase as any).rpc(
    "get_nutrition_trends",
    { p_user_id: user.id, p_days: period }
  );

  if (trendError) {
    return NextResponse.json({ error: trendError.message }, { status: 500 });
  }

  // Fetch the most recent nutrition goal for reference lines
  const { data: goalRow } = await supabase
    .from("nutrition_goals")
    .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
    .eq("user_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const days: NutritionTrendDay[] = (trendRows ?? []).map((r: {
    day: string;
    calories: number | string;
    protein_g: number | string;
    carbs_g: number | string;
    fat_g: number | string;
    entry_count: number;
  }) => ({
    day: r.day,
    calories: Number(r.calories),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    entry_count: r.entry_count,
  }));

  const response: NutritionTrendsResponse = {
    days,
    goals: goalRow
      ? {
          calories_target: goalRow.calories_target,
          protein_g_target: goalRow.protein_g_target,
          carbs_g_target: goalRow.carbs_g_target,
          fat_g_target: goalRow.fat_g_target,
        }
      : null,
  };

  return NextResponse.json(response);
}
