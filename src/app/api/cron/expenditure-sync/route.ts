import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EXPENDITURE_SYNC_ENABLED_SERVER as EXPENDITURE_SYNC_ENABLED } from "@/lib/features.server";
import { logger } from "@/lib/logger";

type FitnessGoal =
  | "lose_weight"
  | "build_muscle"
  | "maintain"
  | "improve_endurance"
  | "bulk"
  | "cut";

/**
 * Determine calorie adjustment based on goal and weekly weight change.
 * Returns delta in kcal (positive = eat more, negative = eat less), or 0 for no change.
 */
function calculateAdjustment(
  goal: FitnessGoal,
  weeklyChangeKg: number,
): number {
  switch (goal) {
    case "build_muscle":
    case "bulk":
      if (weeklyChangeKg > 0.5) return -150; // gaining too fast
      if (weeklyChangeKg < 0.1) return 150; // not gaining enough
      return 0;

    case "lose_weight":
    case "cut":
      // weeklyChangeKg is negative when losing weight
      if (weeklyChangeKg > -0.2) return -150; // not losing enough (losing < 0.2kg/week)
      if (weeklyChangeKg < -0.7) return 150; // losing too fast (losing > 0.7kg/week)
      return 0;

    case "maintain":
    case "improve_endurance":
      if (weeklyChangeKg > 0.3) return -150; // drifting up
      if (weeklyChangeKg < -0.3) return 150; // drifting down
      return 0;

    default:
      return 0;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!EXPENDITURE_SYNC_ENABLED) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
  }

  try {
    const supabase = await createClient();

    // Fetch all users who have a fitness_goal set
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, fitness_goal")
      .not("fitness_goal", "is", null);

    if (usersError) {
      logger.error("Expenditure sync: failed to fetch users", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    let processed = 0;
    let adjusted = 0;

    for (const user of users || []) {
      processed++;

      // Fetch last 7 body_weight_logs
      const { data: weightLogs, error: logsError } = await supabase
        .from("body_weight_logs")
        .select("weight_kg, logged_date")
        .eq("user_id", user.id)
        .order("logged_date", { ascending: false })
        .limit(7);

      if (logsError || !weightLogs || weightLogs.length < 4) {
        continue; // insufficient data
      }

      const newest = weightLogs[0];
      const oldest = weightLogs[weightLogs.length - 1];

      // Calculate time span in weeks
      const newestDate = new Date(newest.logged_date);
      const oldestDate = new Date(oldest.logged_date);
      const daySpan =
        (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
      const weekSpan = daySpan / 7;

      if (weekSpan < 0.5) continue; // too short a window

      const totalChange = newest.weight_kg - oldest.weight_kg;
      const weeklyChange = totalChange / weekSpan;

      const delta = calculateAdjustment(
        user.fitness_goal as FitnessGoal,
        weeklyChange,
      );

      if (delta === 0) continue;

      // Fetch current nutrition_goals (latest by effective_from)
      const { data: currentGoals, error: goalsError } = await supabase
        .from("nutrition_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goalsError || !currentGoals || !currentGoals.calories_target) {
        continue;
      }

      const currentCals = currentGoals.calories_target;
      const newCals = currentCals + delta;

      // Proportionally adjust carbs and fat (keep protein unchanged)
      const currentProtein = currentGoals.protein_g_target ?? 0;
      const currentCarbs = currentGoals.carbs_g_target ?? 0;
      const currentFat = currentGoals.fat_g_target ?? 0;

      // Calories from protein stay the same; redistribute delta among carbs & fat
      const proteinCals = currentProtein * 4;
      const nonProteinCals = currentCals - proteinCals;
      const newNonProteinCals = newCals - proteinCals;

      let newCarbs = currentCarbs;
      let newFat = currentFat;

      if (nonProteinCals > 0) {
        const ratio = newNonProteinCals / nonProteinCals;
        newCarbs = Math.round(currentCarbs * ratio);
        newFat = Math.round(currentFat * ratio);
      }

      // Set effective_from to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const effectiveFrom = tomorrow.toISOString().split("T")[0];

      const { error: insertError } = await supabase
        .from("nutrition_goals")
        .insert({
          user_id: user.id,
          calories_target: newCals,
          protein_g_target: currentGoals.protein_g_target,
          carbs_g_target: newCarbs,
          fat_g_target: newFat,
          fiber_g_target: currentGoals.fiber_g_target,
          effective_from: effectiveFrom,
        });

      if (insertError) {
        logger.error(
          `Expenditure sync: insert failed for user ${user.id}`,
          insertError,
        );
        continue;
      }

      adjusted++;
    }

    return NextResponse.json({ processed, adjusted });
  } catch (err) {
    logger.error("Expenditure sync cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
