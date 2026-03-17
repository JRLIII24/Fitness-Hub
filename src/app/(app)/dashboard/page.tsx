import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";
import { getUserTimezone, getDateInTimezone, getHourInTimezone } from "@/lib/timezone";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Safety-net cleanup: removes active_workout_sessions older than 4 hours.
  // Handles ghost "currently working out" states left by app crashes.
  // Fire-and-forget — dashboard load is never blocked by this.
  // pg_cron (migration 039) is the primary scheduler; this is the fallback.
  void supabase.rpc("cleanup_stale_workouts");

  // ── Timezone-aware date calculations ──────────────────────────────────────
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const todayStr = getDateInTimezone(now, timezone);
  const hourNow = getHourInTimezone(timezone);

  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = getDateInTimezone(yesterdayDate, timezone);

  // ── Parallel data fetching ────────────────────────────────────────────────
  const [
    profileResult,
    workoutSummaryResult,
    nutritionGoalResult,
    nutritionSummaryResult,
    recentFoodsResult,
    intentResult,
    todayWorkoutResult,
    yesterdayWorkoutResult,
  ] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select(
        "display_name, fitness_goal, current_streak, streak_milestones_unlocked, streak_freeze_available, xp, level, preferred_workout_days"
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("get_dashboard_workout_summary", { p_user_id: user.id }),
    supabase
      .from("nutrition_goals")
      .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
      .eq("user_id", user.id)
      .lte("effective_from", todayStr)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_dashboard_nutrition_summary", {
      p_user_id: user.id,
      p_date_str: todayStr,
      p_timezone: timezone,
    }),
    supabase
      .from("food_log")
      .select("logged_at, food_items(id, name, brand)")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(40),
    supabase
      .from("user_intents")
      .select("id, intent_type, intent_payload, intent_for_date, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Lightweight check: did user work out today?
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${todayStr}T00:00:00`)
      .lt("started_at", `${todayStr}T23:59:59.999`)
      .limit(1),
    // Lightweight check: did user work out yesterday?
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${yesterdayStr}T00:00:00`)
      .lt("started_at", `${yesterdayStr}T23:59:59.999`)
      .limit(1),
  ]);

  // ── Profile ───────────────────────────────────────────────────────────────
  const profile =
    profileResult.status === "fulfilled"
      ? (profileResult.value.data as {
          display_name: string | null;
          fitness_goal: string | null;
          current_streak: number;
          streak_milestones_unlocked: number[];
          streak_freeze_available: boolean;
          xp: number;
          level: number;
          preferred_workout_days: number[] | null;
        } | null)
      : null;

  // ── Workout summary (from RPC) ────────────────────────────────────────────
  type WorkoutSummaryRow = {
    total_sessions: number;
    sessions_7d: number;
    sessions_28d: number;
    avg_volume_28d: number;
    latest_id: string | null;
    latest_name: string | null;
    latest_started_at: string | null;
    latest_duration: number | null;
    latest_volume_kg: number | null;
  };

  const workoutSummary: WorkoutSummaryRow | null =
    workoutSummaryResult.status === "fulfilled"
      ? ((workoutSummaryResult.value.data as WorkoutSummaryRow[] | null)?.[0] ?? null)
      : null;

  const totalSessionCount = workoutSummary?.total_sessions ?? 0;
  const sessions7d = workoutSummary?.sessions_7d ?? 0;
  const sessions28d = workoutSummary?.sessions_28d ?? 0;
  const avgVolumeKg = workoutSummary?.avg_volume_28d ?? 0;

  const lastWorkout = workoutSummary?.latest_id
    ? {
        id: workoutSummary.latest_id,
        name: workoutSummary.latest_name ?? "Workout",
        started_at: workoutSummary.latest_started_at ?? "",
        duration_seconds: workoutSummary.latest_duration,
        total_volume_kg: workoutSummary.latest_volume_kg,
        status: "completed" as const,
      }
    : null;

  // ── Nutrition goal ────────────────────────────────────────────────────────
  type GoalRow = {
    calories_target: number | null;
    protein_g_target: number | null;
    carbs_g_target: number | null;
    fat_g_target: number | null;
  };

  const nutritionGoal: GoalRow | null =
    nutritionGoalResult.status === "fulfilled"
      ? (nutritionGoalResult.value.data as GoalRow | null)
      : null;

  // ── Nutrition summary (from RPC) ──────────────────────────────────────────
  type NutritionSummaryRow = {
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    total_fiber_g: number;
    total_sugar_g: number;
    total_sodium_mg: number;
    total_servings: number;
  };

  const nutritionSummary: NutritionSummaryRow | null =
    nutritionSummaryResult.status === "fulfilled"
      ? ((nutritionSummaryResult.value.data as NutritionSummaryRow[] | null)?.[0] ?? null)
      : null;

  const todayCalories = Number(nutritionSummary?.total_calories ?? 0);
  const todayProtein = Number(nutritionSummary?.total_protein_g ?? 0);
  const todayCarbs = Number(nutritionSummary?.total_carbs_g ?? 0);
  const todayFat = Number(nutritionSummary?.total_fat_g ?? 0);
  const todayFiber = Number(nutritionSummary?.total_fiber_g ?? 0);
  const todaySugar = Number(nutritionSummary?.total_sugar_g ?? 0);
  const todaySodiumMg = Number(nutritionSummary?.total_sodium_mg ?? 0);
  const todayServings = Number(nutritionSummary?.total_servings ?? 0);
  const calorieGoal = nutritionGoal?.calories_target ?? null;

  // ── Recent foods (for quick-add) ──────────────────────────────────────────
  type RecentFoodRow = {
    logged_at: string;
    food_items:
      | { id: string; name: string; brand: string | null }
      | { id: string; name: string; brand: string | null }[]
      | null;
  };

  const recentFoodRows: RecentFoodRow[] =
    recentFoodsResult.status === "fulfilled"
      ? ((recentFoodsResult.value.data ?? []) as RecentFoodRow[])
      : [];

  // ── Active intent ─────────────────────────────────────────────────────────
  type IntentRow = {
    id: string;
    intent_type: string;
    intent_payload: { suggested_goal?: string; suggested_duration_min?: number } | null;
    intent_for_date: string | null;
    status: string;
  };

  const activeIntent: IntentRow | null =
    intentResult.status === "fulfilled"
      ? (intentResult.value.data as IntentRow | null)
      : null;

  // ── Derived values ────────────────────────────────────────────────────────
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Athlete";

  const streak = profile?.current_streak ?? 0;
  const milestonesUnlocked = profile?.streak_milestones_unlocked ?? [];
  const freezeAvailable = profile?.streak_freeze_available ?? false;

  const workedOutToday =
    todayWorkoutResult.status === "fulfilled" &&
    (todayWorkoutResult.value.data?.length ?? 0) > 0;

  const workedOutYesterday =
    yesterdayWorkoutResult.status === "fulfilled" &&
    (yesterdayWorkoutResult.value.data?.length ?? 0) > 0;

  // Rest day detection: today's DOW not in preferred_workout_days
  const preferredDays: number[] | null = profile?.preferred_workout_days ?? null;
  // Get DOW in user's timezone (0=Sun..6=Sat) using weekday formatter
  const todayDow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now)
  );
  const isRestDay = preferredDays !== null && preferredDays.length > 0 && !preferredDays.includes(todayDow);

  const streakAtRisk = !workedOutToday && streak > 0 && !isRestDay;
  const momentumUrgency: "low" | "medium" | "high" =
    !streakAtRisk ? "low" : hourNow >= 20 ? "high" : hourNow >= 14 ? "medium" : "low";
  const weeklyMomentumGoal = 4;
  const weeklyProgressPct = Math.min(
    100,
    Math.round((sessions7d / weeklyMomentumGoal) * 100)
  );
  const weeklyAverageSessions = sessions28d / 4;
  const projectedSessions90d = Math.max(0, Math.round(weeklyAverageSessions * 13));
  const projectedVolumeKg = Math.round(projectedSessions90d * avgVolumeKg);

  const quickAddFoods = (() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; brand: string | null }> = [];
    for (const row of recentFoodRows) {
      const food = Array.isArray(row.food_items) ? row.food_items[0] ?? null : row.food_items;
      if (!food || seen.has(food.id)) continue;
      seen.add(food.id);
      result.push(food);
      if (result.length >= 6) break;
    }
    return result;
  })();

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const fatigueSnapshot = await getCachedOrComputeFatigueSnapshot(user.id);

  // Dashboard phase state machine
  type DashboardPhase = "morning" | "pre_workout" | "active" | "post_workout" | "evening";
  let dashboardPhase: DashboardPhase;
  if (workedOutToday) {
    const lastSessionTime = lastWorkout ? new Date(lastWorkout.started_at).getTime() : 0;
    const hoursSinceLastWorkout = (Date.now() - lastSessionTime) / (1000 * 60 * 60);
    dashboardPhase = hoursSinceLastWorkout <= 2 ? "post_workout" : "evening";
  } else if (hourNow < 12) {
    dashboardPhase = "morning";
  } else if (hourNow < 20) {
    dashboardPhase = "pre_workout";
  } else {
    dashboardPhase = "evening";
  }

  return (
    <DashboardContent
      userId={user.id}
      displayName={displayName}
      todayFormatted={todayFormatted}
      todayStr={todayStr}
      level={profile?.level ?? 1}
      xp={profile?.xp ?? 0}
      streak={streak}
      milestonesUnlocked={milestonesUnlocked}
      freezeAvailable={freezeAvailable}
      totalSessionCount={totalSessionCount}
      thisWeekSessionCount={sessions7d}
      lastWorkout={lastWorkout}
      workedOutToday={workedOutToday}
      workedOutYesterday={workedOutYesterday}
      streakAtRisk={streakAtRisk}
      isRestDay={isRestDay}
      momentumUrgency={momentumUrgency}
      weeklyMomentumGoal={weeklyMomentumGoal}
      weeklyProgressPct={weeklyProgressPct}
      weeklyAverageSessions={weeklyAverageSessions}
      projectedSessions90d={projectedSessions90d}
      projectedVolumeKg={projectedVolumeKg}
      calorieGoal={calorieGoal}
      todayCalories={todayCalories}
      todayProtein={todayProtein}
      todayCarbs={todayCarbs}
      todayFat={todayFat}
      todayFiber={todayFiber}
      todaySugar={todaySugar}
      todaySodiumMg={todaySodiumMg}
      todayServings={todayServings}
      nutritionGoal={nutritionGoal}
      activeIntent={activeIntent}
      quickAddFoods={quickAddFoods}
      fatigueSnapshot={fatigueSnapshot}
      dashboardPhase={dashboardPhase}
    />
  );
}
