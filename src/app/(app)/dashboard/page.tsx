import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Dumbbell,
  Apple,
  TrendingUp,
  Flame,
  Zap,
  CalendarDays,
  ChevronRight,
  Trophy,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MACRO_COLORS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { StreakSection } from "@/components/dashboard/streak-section";
import { MomentumProtectionCard } from "@/components/dashboard/momentum-protection-card";
import { SmartLauncherWidget } from "@/components/workout/smart-launcher-widget";
import { AdaptiveWorkoutCard } from "@/components/workout/adaptive-workout-card";
import { PodsDashboardCard } from "@/components/pods/pods-dashboard-card";
import { ProUpgradeCard } from "@/components/dashboard/pro-upgrade-card";

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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
  ] =
    await Promise.allSettled([
      supabase
        .from("profiles")
        .select("display_name, fitness_goal, current_streak, streak_milestones_unlocked, streak_freeze_available, xp, level")
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

  // Use database streak instead of manual calculation
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
    (s) => new Date(s.started_at).getTime() >= Date.now() - 28 * 86400000
  );
  const weeklyAverageSessions = sessions28d.length / 4;
  const projectedSessions90d = Math.max(0, Math.round(weeklyAverageSessions * 13));
  const avgVolumeKg =
    sessions28d.length > 0
      ? sessions28d.reduce((sum, s) => sum + (s.total_volume_kg ?? 0), 0) / sessions28d.length
      : 0;
  const projectedVolumeKg = Math.round(projectedSessions90d * avgVolumeKg);

  const todayCalories = todayFood.reduce((sum, e) => sum + (e.calories_consumed ?? 0), 0);
  const calorieGoal = nutritionGoal?.calories_target ?? null;
  const calorieProgress = calorieGoal
    ? Math.min(100, Math.round((todayCalories / calorieGoal) * 100))
    : null;
  const caloriesRemaining = calorieGoal ? Math.max(0, calorieGoal - todayCalories) : null;

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 pt-6 md:px-6">
      <section className="fade-in relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {today.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {workedOutToday ? `Performance Locked, ${displayName}` : `Build Momentum, ${displayName}`}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {workedOutToday
                  ? "Session complete. Keep the edge by recovering and logging nutrition precisely."
                  : "Your next session defines the week. Start now and protect your streak."}
              </p>
            </div>
            <StreakSection
              userId={user.id}
              currentStreak={streak}
              milestonesUnlocked={milestonesUnlocked}
              freezeAvailable={freezeAvailable}
              level={profile?.level ?? 1}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard
              icon={<Flame className="h-5 w-5 text-accent" />}
              value={streak}
              label="Day Streak"
              className="border-border/80 bg-card/80"
            />
            <StatCard
              icon={<Dumbbell className="h-5 w-5 text-primary" />}
              value={thisWeekSessions.length}
              label="This Week"
              className="border-border/80 bg-card/80"
            />
            <StatCard
              icon={<Trophy className="h-5 w-5 text-yellow-400" />}
              value={sessions.length}
              label="Total"
              className="border-border/80 bg-card/80"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Link href="/workout">
              <Button className="motion-press h-12 w-full justify-center rounded-xl text-xs sm:text-sm font-semibold">Start Workout</Button>
            </Link>
            <Link href="/nutrition">
              <Button variant="secondary" className="motion-press h-12 w-full justify-center rounded-xl text-xs sm:text-sm font-semibold">
                Log Nutrition
              </Button>
            </Link>
            <Link href="/history/progress">
              <Button variant="secondary" className="motion-press h-12 w-full justify-center rounded-xl text-xs sm:text-sm font-semibold">
                View Progress
              </Button>
            </Link>
          </div>

          {streakAtRisk ? (
            <MomentumProtectionCard
              userId={user.id}
              urgency={momentumUrgency}
              workedOutYesterday={workedOutYesterday}
              freezeAvailable={freezeAvailable}
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4 fade-in">
          <SmartLauncherWidget />
          <AdaptiveWorkoutCard />

          <Card className="border-border/70 bg-card/85">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Future Self · 90 Day Path
              </CardTitle>
              <Badge variant="secondary" className="rounded-full px-2 text-xs">
                {Math.round(weeklyAverageSessions * 10) / 10} sessions/week
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Stay on this path and you&apos;re projected to complete{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {projectedSessions90d}
                </span>{" "}
                workouts in the next 90 days.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-secondary/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    7-Day Momentum Goal
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {thisWeekSessions.length}/{weeklyMomentumGoal}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Projected Volume
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {projectedVolumeKg.toLocaleString()} kg
                  </p>
                </div>
              </div>
              <Progress value={weeklyProgressPct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Consistency compounds. Keep stacking sessions to shift this curve up.
              </p>
            </CardContent>
          </Card>

          {activeIntent ? (
            <Card className="border-primary/30 bg-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Momentum Contract</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {activeIntent.intent_payload?.suggested_goal ?? "Complete one focused session tomorrow."}
                </p>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-xs">
                  <span className="text-muted-foreground uppercase tracking-[0.12em]">Target Date</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {activeIntent.intent_for_date ?? "Tomorrow"}
                  </span>
                </div>
                <Link href="/workout">
                  <Button size="sm" className="motion-press w-full">
                    Lock In Session
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/85">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="h-4 w-4 text-primary" />
                Today&apos;s Nutrition
              </CardTitle>
              <Link href="/nutrition">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  Log food <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {calorieGoal ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-3xl font-bold tabular-nums">{Math.round(todayCalories)}</span>
                      <span className="ml-1 text-sm text-muted-foreground">/ {calorieGoal} kcal</span>
                    </div>
                    {caloriesRemaining !== null ? (
                      <Badge variant="secondary" className="rounded-full px-2 text-xs">
                        {Math.round(caloriesRemaining)} left
                      </Badge>
                    ) : null}
                  </div>
                  <Progress value={calorieProgress ?? 0} className="h-2" />

                  <div className="grid grid-cols-3 gap-3 text-center">
                    {(
                      [
                        { label: "Protein", value: todayProtein, color: MACRO_COLORS.protein, goal: nutritionGoal?.protein_g_target },
                        { label: "Carbs", value: todayCarbs, color: MACRO_COLORS.carbs, goal: nutritionGoal?.carbs_g_target },
                        { label: "Fat", value: todayFat, color: MACRO_COLORS.fat, goal: nutritionGoal?.fat_g_target },
                      ] as const
                    ).map((macro) => (
                      <div key={macro.label} className="rounded-lg bg-secondary/50 py-2">
                        <p className={`text-base font-bold tabular-nums ${macro.color}`}>
                          {Math.round(macro.value)}
                          <span className="text-xs font-normal text-muted-foreground">g</span>
                        </p>
                        {macro.goal ? <p className="text-[10px] text-muted-foreground">/ {macro.goal}g</p> : null}
                        <p className="text-[10px] font-medium text-muted-foreground">{macro.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 text-center">
                    {[
                      { label: "Fiber", value: `${Math.round(todayFiber)}g`, color: MACRO_COLORS.fiber },
                      { label: "Sugar", value: `${Math.round(todaySugar)}g`, color: "text-rose-400" },
                      { label: "Sodium", value: `${Math.round(todaySodiumMg)}mg`, color: "text-cyan-400" },
                      { label: "Servings", value: `${Math.round(todayServings * 10) / 10}`, color: "text-violet-400" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-secondary/50 py-2">
                        <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Set your daily calorie goal to track nutrition here.
                  </p>
                  <Link href="/nutrition/goals">
                    <Button variant="outline" size="sm">Set Goals</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/85">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Last Workout
              </CardTitle>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {lastWorkout ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lastWorkout.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(lastWorkout.started_at)}</p>
                    </div>
                    {lastWorkout.started_at.startsWith(todayStr) ? (
                      <Badge className="border-primary/30 bg-primary/20 text-[10px] text-primary">Today</Badge>
                    ) : null}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium">{formatDuration(lastWorkout.duration_seconds)}</p>
                    </div>
                    {lastWorkout.total_volume_kg ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Volume</p>
                        <p className="font-medium">{Math.round(lastWorkout.total_volume_kg).toLocaleString()} kg</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">No workouts yet. Start your first session.</p>
                  <Link href="/workout">
                    <Button size="sm">
                      <Dumbbell className="mr-2 h-4 w-4" />
                      Start Workout
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 fade-in">
          <PodsDashboardCard />
          <ProUpgradeCard userId={user.id} />

          <Card className="border-border/70 bg-card/85">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="h-4 w-4 text-primary" />
                Quick Add Recent Foods
              </CardTitle>
              <Link href="/nutrition/scan">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  Open scanner <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {quickAddFoods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent foods yet. Log your first item to enable quick add.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {quickAddFoods.map((food) => (
                    <Link
                      key={food.id}
                      href={`/nutrition/scan?quick_food_id=${encodeURIComponent(food.id)}`}
                      className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
                    >
                      <p className="truncate text-sm font-medium">{food.name}</p>
                      {food.brand ? (
                        <p className="truncate text-xs text-muted-foreground">{food.brand}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Tap to log quickly</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
