You are a senior Next.js + React TypeScript UI engineer.
Task: redesign and enhance the dashboard UI to a premium, original fitness-app quality while preserving behavior and logic.

Rules:
- Do not copy Nike/MyFitnessPal visuals or branding; create an original design system.
- Preserve all business logic, Supabase calls, analytics/retention events, routes, and prop interfaces.
- Keep TypeScript strict and compatible.
- Keep all existing dashboard sections; improve hierarchy, spacing, card design, responsiveness, and accessibility.
- Use existing UI primitives (Card, Button, Badge, Progress, etc.) unless necessary.
- Return complete updated code per file, then a concise changelog.

Files and current code:

===== BEGIN FILE: src/app/(app)/dashboard/page.tsx =====
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
===== END FILE: src/app/(app)/dashboard/page.tsx =====

===== BEGIN FILE: src/components/dashboard/streak-section.tsx =====
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StreakBadge } from "./streak-badge";
import { LevelUpCelebration } from "./level-up-celebration";
import { useSupabase } from "@/hooks/use-supabase";
import { toast } from "sonner";

interface StreakSectionProps {
  userId: string;
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  level: number;
}

export function StreakSection({
  userId,
  currentStreak,
  milestonesUnlocked,
  freezeAvailable,
  level,
}: StreakSectionProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(level);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });

      if (error) throw error;

      if (data) {
        toast.success("Streak freeze activated! Your streak is protected for today.");
        router.refresh();
      } else {
        toast.error("No streak freeze available");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      toast.error("Failed to activate streak freeze");
    }
  }

  return (
    <>
      <StreakBadge
        currentStreak={currentStreak}
        milestonesUnlocked={milestonesUnlocked}
        freezeAvailable={freezeAvailable}
        onUseFreeze={handleUseFreeze}
        className="mt-1"
      />

      {showLevelUp && (
        <LevelUpCelebration
          newLevel={newLevel}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </>
  );
}
===== END FILE: src/components/dashboard/streak-section.tsx =====

===== BEGIN FILE: src/components/dashboard/streak-badge.tsx =====
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface StreakBadgeProps {
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  onUseFreeze?: () => void;
  className?: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  7: "Week Warrior",
  30: "Monthly Master",
  100: "Centurion",
  365: "Year Champion",
};

const MILESTONE_COLORS: Record<number, string> = {
  7: "from-yellow-500/20 to-amber-500/20 border-yellow-400/30 text-yellow-400",
  30: "from-orange-500/20 to-red-500/20 border-orange-400/30 text-orange-400",
  100: "from-purple-500/20 to-pink-500/20 border-purple-400/30 text-purple-400",
  365: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-400",
};

export function StreakBadge({
  currentStreak,
  milestonesUnlocked = [],
  freezeAvailable,
  onUseFreeze,
  className,
}: StreakBadgeProps) {
  const [showMilestoneNotification, setShowMilestoneNotification] = useState<number | null>(null);
  const [previousMilestones, setPreviousMilestones] = useState<number[]>(milestonesUnlocked);

  // Detect new milestone unlocks
  useEffect(() => {
    const newMilestones = milestonesUnlocked.filter(
      (m) => !previousMilestones.includes(m)
    );

    if (newMilestones.length > 0) {
      const latestMilestone = Math.max(...newMilestones);
      setShowMilestoneNotification(latestMilestone);

      // Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setShowMilestoneNotification(null);
      }, 5000);

      setPreviousMilestones(milestonesUnlocked);
    }
  }, [milestonesUnlocked, previousMilestones]);

  const nextMilestone = [7, 30, 100, 365].find((m) => m > currentStreak) ?? null;
  const daysToNext = nextMilestone ? nextMilestone - currentStreak : null;

  return (
    <div className={cn("relative", className)}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4 space-y-3">
          {/* Streak Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={currentStreak > 0 ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0],
                } : {}}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Flame className="h-6 w-6 text-orange-500" />
              </motion.div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {currentStreak}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">day streak</span>
                </p>
                {daysToNext && (
                  <p className="text-xs text-muted-foreground">
                    {daysToNext} days until {MILESTONE_LABELS[nextMilestone!]}
                  </p>
                )}
              </div>
            </div>

            {/* Freeze Badge */}
            {freezeAvailable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onUseFreeze}
                className="gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                title="Use streak freeze (1x/month)"
              >
                <Snowflake className="h-3 w-3" />
                Freeze
              </Button>
            )}
          </div>

          {/* Milestones Grid */}
          {milestonesUnlocked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[7, 30, 100, 365].map((milestone) => {
                const isUnlocked = milestonesUnlocked.includes(milestone);
                return (
                  <motion.div
                    key={milestone}
                    initial={isUnlocked ? { scale: 0 } : false}
                    animate={isUnlocked ? { scale: 1 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-[10px] font-semibold transition-all",
                        isUnlocked
                          ? `bg-gradient-to-r ${MILESTONE_COLORS[milestone]}`
                          : "border-muted-foreground/30 bg-muted/20 text-muted-foreground opacity-50"
                      )}
                    >
                      {isUnlocked && <Trophy className="h-2.5 w-2.5" />}
                      {milestone}d
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Unlock Notification */}
      <AnimatePresence>
        {showMilestoneNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-10"
          >
            <Card className={cn(
              "border-2 bg-gradient-to-r shadow-lg",
              MILESTONE_COLORS[showMilestoneNotification]
            )}>
              <CardContent className="p-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <div className="text-sm font-semibold">
                  <p>{MILESTONE_LABELS[showMilestoneNotification]} Unlocked!</p>
                  <p className="text-xs opacity-80">{showMilestoneNotification}-day streak</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
===== END FILE: src/components/dashboard/streak-badge.tsx =====

===== BEGIN FILE: src/components/dashboard/momentum-protection-card.tsx =====
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock3, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import {
  logRetentionEvent,
  trackComebackPlanCompleted,
  trackComebackPlanStarted,
} from "@/lib/retention-events";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MomentumProtectionCardProps {
  userId: string;
  urgency: "low" | "medium" | "high";
  workedOutYesterday: boolean;
  freezeAvailable: boolean;
}

export function MomentumProtectionCard({
  userId,
  urgency,
  workedOutYesterday,
  freezeAvailable,
}: MomentumProtectionCardProps) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `retention:momentum_protection_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(dedupeKey, "1");
    }

    void logRetentionEvent(supabase, {
      userId,
      eventType: "momentum_protection_shown",
      sourceScreen: "dashboard",
      metadata: {
        urgency,
        worked_out_yesterday: workedOutYesterday,
        freeze_available: freezeAvailable,
      },
    });
  }, [freezeAvailable, supabase, urgency, userId, workedOutYesterday]);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });
      if (error) throw error;

      if (data === true) {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_used",
          sourceScreen: "dashboard",
          metadata: { urgency },
        });
        void trackComebackPlanCompleted(supabase, userId, {
          channel: "streak_freeze",
          urgency,
        });
        toast.success("Streak freeze activated. Momentum protected for today.");
        router.refresh();
      } else {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_failed",
          sourceScreen: "dashboard",
          metadata: { reason: "not_available", urgency },
        });
        toast.error("No streak freeze available.");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      void logRetentionEvent(supabase, {
        userId,
        eventType: "streak_freeze_failed",
        sourceScreen: "dashboard",
        metadata: { reason: "rpc_error", urgency },
      });
      toast.error("Failed to activate streak freeze.");
    }
  }

  return (
    <Card
      className={`border ${
        urgency === "high"
          ? "border-rose-500/50 bg-rose-500/10"
          : urgency === "medium"
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-primary/40 bg-primary/10"
      }`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Momentum Protection
          </p>
          <p className="mt-1 text-sm font-semibold">
            {urgency === "high"
              ? "Your streak is at risk tonight."
              : workedOutYesterday
                ? "Keep the streak alive with one focused session."
                : "A quick session today restores momentum."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {urgency === "high"
              ? "Log a workout now to avoid losing your current run."
              : "You are closer than you think. Protect the momentum."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {urgency === "high" ? (
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          ) : (
            <Clock3 className="h-4 w-4 text-amber-400" />
          )}
          {freezeAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={handleUseFreeze}
            >
              <Snowflake className="mr-1.5 h-3.5 w-3.5" />
              Use Freeze
            </Button>
          ) : (
            <Link href="/workout">
              <Button
                size="sm"
                className="motion-press h-8 rounded-lg px-3 text-xs"
                onClick={() => {
                  void trackComebackPlanStarted(supabase, userId, {
                    channel: "start_workout",
                    urgency,
                  });
                }}
              >
                Protect
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
===== END FILE: src/components/dashboard/momentum-protection-card.tsx =====

===== BEGIN FILE: src/components/dashboard/pro-upgrade-card.tsx =====
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Sparkles, LineChart, ShieldCheck } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProUpgradeCardProps {
  userId: string;
}

export function ProUpgradeCard({ userId }: ProUpgradeCardProps) {
  const supabase = useSupabase();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `conversion:pro_upgrade_card:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void supabase.from("conversion_impressions").insert({
      user_id: userId,
      placement: "dashboard",
      impression_type: "locked_preview",
      variant: "pro_card_v1",
      metadata: {
        module: "analytics_and_coaching",
      },
    });
  }, [supabase, userId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card/85">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Pro Performance Layer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ve built momentum. Unlock coaching-grade trend models and pod competition analytics.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span>Advanced PR trajectory forecasting</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Accountability pod pressure index</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Adaptive fueling recommendations</span>
          </div>
        </div>
        <Link href="/settings" className="block">
          <Button className="motion-press w-full" size="sm">
            Unlock Pro Preview
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
===== END FILE: src/components/dashboard/pro-upgrade-card.tsx =====

===== BEGIN FILE: src/components/dashboard/level-up-celebration.tsx =====
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

interface LevelUpCelebrationProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpCelebration({ newLevel, onClose }: LevelUpCelebrationProps) {
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    // Stage 1: Radial burst confetti
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FFA500", "#FF6B9D", "#C471ED"],
      startVelocity: 45,
      gravity: 0.8,
      shapes: ["star", "circle"],
    });

    // Stage 2: Show card after 300ms
    setTimeout(() => {
      setShowCard(true);
    }, 300);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative mx-4 w-full max-w-sm"
          >
            <Card className="relative overflow-hidden border-2 border-primary/50 bg-gradient-to-br from-card via-primary/5 to-card p-6 shadow-2xl">
              {/* Animated Background Glow */}
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-pink-500/20"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 z-10"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Content */}
              <div className="relative text-center space-y-4">
                {/* Level Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="inline-block"
                >
                  <div className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 p-4 shadow-lg">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                    Level Up!
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You've reached level {newLevel}
                  </p>
                </motion.div>

                {/* Level Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                  className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-6"
                >
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-bold tabular-nums text-primary">
                      {newLevel}
                    </span>
                    <span className="text-2xl font-semibold text-muted-foreground">
                      LVL
                    </span>
                  </div>
                </motion.div>

                {/* Motivational Message */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  You're getting stronger! 💪
                </motion.p>

                {/* Continue Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={onClose}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </motion.div>
              </div>

              {/* Decorative Elements */}
              <motion.div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-yellow-400/20 blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-orange-400/20 blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5,
                }}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
===== END FILE: src/components/dashboard/level-up-celebration.tsx =====

Deliverables:
1) Updated full code for each file above
2) Summary of visual/UX improvements by file
3) Any follow-up suggestions (optional)
