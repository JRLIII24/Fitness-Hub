import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getCachedOrComputeFatigueSnapshot } from "@/lib/fatigue/server";

function toDayKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = new Date();
  const localDayStart = new Date(today);
  localDayStart.setHours(0, 0, 0, 0);
  const localNextDayStart = new Date(localDayStart);
  localNextDayStart.setDate(localNextDayStart.getDate() + 1);
  const todayStr = `${localDayStart.getFullYear()}-${String(
    localDayStart.getMonth() + 1
  ).padStart(2, "0")}-${String(localDayStart.getDate()).padStart(2, "0")}`;
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString();

  const [
    profileResult,
    sessionsResult,
    nutritionGoalResult,
    todayFoodResult,
    recentFoodsResult,
    intentResult,
  ] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select(
        "display_name, fitness_goal, current_streak, streak_milestones_unlocked, streak_freeze_available, xp, level"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("workout_sessions")
      .select("id, name, started_at, duration_seconds, total_volume_kg, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(60),
    supabase
      .from("nutrition_goals")
      .select("calories_target, protein_g_target, carbs_g_target, fat_g_target")
      .eq("user_id", user.id)
      .lte("effective_from", todayStr)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("food_log")
      .select(
        "calories_consumed, protein_g, carbs_g, fat_g, servings, food_items(fiber_g, sugar_g, sodium_mg)"
      )
      .eq("user_id", user.id)
      .gte("logged_at", localDayStart.toISOString())
      .lt("logged_at", localNextDayStart.toISOString()),
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
  ]);

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
        } | null)
      : null;

  type SessionRow = {
    id: string;
    name: string;
    started_at: string;
    duration_seconds: number | null;
    total_volume_kg: number | null;
    status: string;
  };

  const sessions: SessionRow[] =
    sessionsResult.status === "fulfilled"
      ? ((sessionsResult.value.data ?? []) as SessionRow[])
      : [];

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

  type FoodRow = {
    calories_consumed: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    servings: number;
    food_items:
      | { fiber_g: number | null; sugar_g: number | null; sodium_mg: number | null }
      | { fiber_g: number | null; sugar_g: number | null; sodium_mg: number | null }[]
      | null;
  };

  const todayFood: FoodRow[] =
    todayFoodResult.status === "fulfilled"
      ? ((todayFoodResult.value.data ?? []) as FoodRow[])
      : [];

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

  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Athlete";

  const workoutDays = new Set(
    sessions.map((s) => new Date(s.started_at).toISOString().split("T")[0])
  );

  const streak = profile?.current_streak ?? 0;
  const milestonesUnlocked = profile?.streak_milestones_unlocked ?? [];
  const freezeAvailable = profile?.streak_freeze_available ?? false;

  const thisWeekSessions = sessions.filter(
    (s) => new Date(s.started_at) >= new Date(sevenDaysAgo)
  );
  const lastWorkout = sessions[0] ?? null;
  const workedOutToday = workoutDays.has(todayStr);
  const hourNow = today.getHours();
  const yesterday = new Date(localDayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const workedOutYesterday = workoutDays.has(toDayKey(yesterday));
  const streakAtRisk = !workedOutToday && streak > 0;
  const momentumUrgency: "low" | "medium" | "high" =
    !streakAtRisk ? "low" : hourNow >= 20 ? "high" : hourNow >= 14 ? "medium" : "low";
  const weeklyMomentumGoal = 4;
  const weeklyProgressPct = Math.min(
    100,
    Math.round((thisWeekSessions.length / weeklyMomentumGoal) * 100)
  );
  const sessions28d = sessions.filter(
    (s) => new Date(s.started_at).getTime() >= today.getTime() - 28 * 86400000
  );
  const weeklyAverageSessions = sessions28d.length / 4;
  const projectedSessions90d = Math.max(0, Math.round(weeklyAverageSessions * 13));
  const avgVolumeKg =
    sessions28d.length > 0
      ? sessions28d.reduce((sum, s) => sum + (s.total_volume_kg ?? 0), 0) /
        sessions28d.length
      : 0;
  const projectedVolumeKg = Math.round(projectedSessions90d * avgVolumeKg);

  const todayCalories = todayFood.reduce((sum, e) => sum + (e.calories_consumed ?? 0), 0);
  const calorieGoal = nutritionGoal?.calories_target ?? null;

  const todayProtein = todayFood.reduce((s, e) => s + (e.protein_g ?? 0), 0);
  const todayCarbs = todayFood.reduce((s, e) => s + (e.carbs_g ?? 0), 0);
  const todayFat = todayFood.reduce((s, e) => s + (e.fat_g ?? 0), 0);
  const todayFiber = todayFood.reduce((sum, entry) => {
    const food = Array.isArray(entry.food_items) ? entry.food_items[0] ?? null : entry.food_items;
    return sum + (food?.fiber_g ?? 0) * (entry.servings ?? 1);
  }, 0);
  const todaySugar = todayFood.reduce((sum, entry) => {
    const food = Array.isArray(entry.food_items) ? entry.food_items[0] ?? null : entry.food_items;
    return sum + (food?.sugar_g ?? 0) * (entry.servings ?? 1);
  }, 0);
  const todaySodiumMg = todayFood.reduce((sum, entry) => {
    const food = Array.isArray(entry.food_items) ? entry.food_items[0] ?? null : entry.food_items;
    return sum + (food?.sodium_mg ?? 0) * (entry.servings ?? 1);
  }, 0);
  const todayServings = todayFood.reduce((sum, entry) => sum + (entry.servings ?? 0), 0);

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

  const todayFormatted = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const fatigueSnapshot = await getCachedOrComputeFatigueSnapshot(user.id);

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
      sessions={sessions}
      thisWeekSessions={thisWeekSessions}
      lastWorkout={lastWorkout}
      workedOutToday={workedOutToday}
      workedOutYesterday={workedOutYesterday}
      streakAtRisk={streakAtRisk}
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
    />
  );
}
