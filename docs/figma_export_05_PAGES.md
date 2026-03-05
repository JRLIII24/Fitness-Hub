# Fit-Hub — Pages & Layout Source

---
## src/app/(app)/layout.tsx
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeApplier } from "@/components/theme-applier";
import { PageTransition } from "@/components/layout/page-transition";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { SplashDismisser } from "@/components/layout/splash-dismisser";
import { HealthGuard } from "@/components/layout/health-guard";
import { CoachFabWrapper } from "@/components/coach/coach-fab-wrapper";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-svh bg-background">
      <ThemeApplier />
      <OfflineBanner />
      {/* pb accounts for bottom-nav height (6rem) + device safe-area inset.
          env(safe-area-inset-bottom,0px) is 0 on Android/desktop and up to
          34px on iPhone 14 Pro+, ensuring content is never hidden behind the
          nav or the home indicator on any device. */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <SplashDismisser />
      <HealthGuard />
      <CoachFabWrapper />
    </div>
  );
}
```

---
## src/app/(app)/dashboard/page.tsx
```tsx
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
        "display_name, fitness_goal, current_streak, streak_milestones_unlocked, streak_freeze_available, xp, level"
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

  const streakAtRisk = !workedOutToday && streak > 0;
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
```

---
## src/app/(app)/workout/page.tsx
```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Clock3, NotebookPen, Plus, Save, Dumbbell, Zap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";
import {
  trackSessionIntentSet,
} from "@/lib/retention-events";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import type { ActiveWorkout, Exercise, WorkoutSet } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExerciseSwapSheet } from "@/components/workout/exercise-swap-sheet";
import { useExerciseTrendlines } from "@/hooks/use-exercise-trendlines";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, kgToLbs } from "@/lib/units";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";
import {
  isMissingTableError,
  slugify,
  normalizeEquipment,
  resolveExerciseMediaUrl,
  makeCustomExercise,
} from "@/lib/workout/exercise-resolver";
import { calcSuggestedWeight } from "@/lib/progressive-overload";
import { RestTimerPill } from "@/components/workout/rest-timer-pill";
import { SaveTemplateDialog } from "@/components/workout/save-template-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { ExerciseSelectionCard } from "@/components/workout/exercise-selection-card";
import { WorkoutCompleteCelebration } from "@/components/workout/workout-complete-celebration";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";

// Extracted hooks
import { useGhostSession } from "@/hooks/workout/use-ghost-session";
import { useExerciseSwap } from "@/hooks/workout/use-exercise-swap";
import { useWorkoutCompletion } from "@/hooks/workout/use-workout-completion";
import { useTemplateActions, type WorkoutTemplate } from "@/hooks/workout/use-template-actions";

// Extracted components
import { WorkoutHeader, ElapsedTime } from "@/components/workout/workout-header";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { WorkoutCompletionDialog } from "@/components/workout/workout-completion-dialog";
import { TemplateManagerPanel } from "@/components/workout/template-manager-panel";
import { QuickStartPanel } from "@/components/workout/quick-start-panel";
import { AI_COACH_ENABLED } from "@/lib/features";
import { VoiceCommandBar } from "@/components/coach/voice-command-bar";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const TEMPLATE_LIKES_KEY = "workout_template_likes_v1";

/** Returns true when viewport width <= 639 px (Tailwind `sm` breakpoint). */
function useIsSmallScreen(): boolean {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsSmall(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isSmall;
}

export default function WorkoutPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [dbFeaturesAvailable, setDbFeaturesAvailable] = useState(true);

  const [presetId, setPresetId] = useState<WorkoutPresetId>("upper-body-strength");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [workoutName, setWorkoutName] = useState("Upper Body Strength");
  const [setupTab, setSetupTab] = useState<"templates" | "quick">("templates");
  const [quickFilter, setQuickFilter] = useState<string>("All");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(new Set());
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<{
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null>(null);

  const isSmallScreen = useIsSmallScreen();

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>("chest");
  const [liftPickerOpen, setLiftPickerOpen] = useState(false);
  const [liftSearch, setLiftSearch] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const [customName, setCustomName] = useState("");
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>("full_body");
  const [customEquipment, setCustomEquipment] = useState("bodyweight");
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);

  // API exercise search state
  const [apiExercises, setApiExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const searchRequestSeq = useRef(0);

  const [previousByExerciseId, setPreviousByExerciseId] = useState<
    Record<string, Array<{ reps: number | null; weight: number | null }>>
  >({});
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [exerciseLastPerformance, setExerciseLastPerformance] = useState<
    Record<string, { reps: number | null; weight: number | null; performedAt: string | null }>
  >({});

  // DEV: Uncomment to verify WorkoutPage render frequency.
  // Should NOT increment every second -- only on user interactions.
  // if (process.env.NODE_ENV === 'development') console.count('[WorkoutPage] render');

  // Scoped selectors prevent re-renders from unrelated store slices
  const {
    activeWorkout,
    isWorkoutActive,
    startWorkout,
    loadWorkoutForEdit,
    cancelWorkout,
    finishWorkout,
    addExercise,
    removeExercise,
    swapExercise,
    addSet,
    updateSet,
    removeSet,
    completeSet,
    setExerciseNote,
    setWorkoutNote,
    updateWorkoutName,
  } = useWorkoutStore(
    useShallow((s) => ({
      activeWorkout: s.activeWorkout,
      isWorkoutActive: s.isWorkoutActive,
      startWorkout: s.startWorkout,
      loadWorkoutForEdit: s.loadWorkoutForEdit,
      cancelWorkout: s.cancelWorkout,
      finishWorkout: s.finishWorkout,
      addExercise: s.addExercise,
      removeExercise: s.removeExercise,
      swapExercise: s.swapExercise,
      addSet: s.addSet,
      updateSet: s.updateSet,
      removeSet: s.removeSet,
      completeSet: s.completeSet,
      setExerciseNote: s.setExerciseNote,
      setWorkoutNote: s.setWorkoutNote,
      updateWorkoutName: s.updateWorkoutName,
    }))
  );

  const startTimer = useTimerStore((state) => state.startTimer);
  const getActiveTimers = useTimerStore((state) => state.getActiveTimers);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const { sendTemplate } = useSharedItems(userId);
  const { preference, unitLabel } = useUnitPreferenceStore();

  const toDisplayWeight = useCallback(
    (kg: number) => weightToDisplay(kg, preference === "imperial", 1),
    [preference]
  );

  const toDisplayVolume = useCallback(
    (kgVolume: number) =>
      preference === "imperial"
        ? Math.round(kgToLbs(kgVolume))
        : Math.round(kgVolume),
    [preference]
  );

  const allExercises = useMemo(
    () => [...customExercises, ...apiExercises],
    [customExercises, apiExercises]
  );

  const selectedExerciseIds = useMemo(
    () =>
      new Set(activeWorkout?.exercises.map((workoutExercise) => workoutExercise.exercise.id) ?? []),
    [activeWorkout]
  );

  const filteredByMuscleGroup = useMemo(
    () => allExercises.filter((exercise) => exercise.muscle_group === selectedMuscleGroup),
    [allExercises, selectedMuscleGroup]
  );

  const filteredExercises = useMemo(() => {
    const q = liftSearch.trim().toLowerCase();
    return filteredByMuscleGroup
      .filter((exercise) => (q.length === 0 ? true : exercise.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [liftSearch, filteredByMuscleGroup]);


  const selectedExercise = useMemo(
    () => allExercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [allExercises, selectedExerciseId]
  );

  const plannerStats = useMemo(() => {
    if (!activeWorkout) {
      return { exercises: 0, totalSets: 0, completedSets: 0, totalVolumeKg: 0 };
    }

    const allSets = activeWorkout.exercises.flatMap((exerciseBlock) => exerciseBlock.sets);
    const completedSets = allSets.filter((set) => set.completed).length;
    const totalVolumeKg = allSets.reduce(
      (sum, set) => sum + (set.weight_kg ?? 0) * (set.reps ?? 0),
      0
    );

    return {
      exercises: activeWorkout.exercises.length,
      totalSets: allSets.length,
      completedSets,
      totalVolumeKg,
    };
  }, [activeWorkout]);
  const completionProgressPct =
    plannerStats.totalSets > 0
      ? Math.min(100, Math.round((plannerStats.completedSets / plannerStats.totalSets) * 100))
      : 0;

  // --- Extracted hooks ---

  // Ghost session: loads ghost data for selected template
  const {
    ghostWorkoutData,
    ghostIsLoading,
    suggestedWeightsByKey,
    patchGhostForExercise,
  } = useGhostSession(supabase, userId, selectedTemplateId, preference);

  // Exercise swap: manages swap sheet state + targeted ghost refetch
  const {
    swapSheetIndex,
    setSwapSheetIndex,
    handleSwapExercise,
  } = useExerciseSwap(swapExercise, patchGhostForExercise);

  // Workout completion: finish, cancel, celebration, RPE
  const {
    celebrationStats,
    showCelebration,
    levelUpData,
    sessionRpePromptOpen,
    setSessionRpePromptOpen,
    sessionRpeValue,
    setSessionRpeValue,
    savingSessionRpe,
    handleFinishWorkout,
    handleCancelWorkout,
    handleCloseWorkoutCelebration,
    handleCloseLevelUp,
    handleSaveSessionRpe,
  } = useWorkoutCompletion({
    supabase,
    userId,
    finishWorkout,
    cancelWorkout,
    previousByExerciseId,
    ghostWorkoutData,
    toDisplayWeight,
    toDisplayVolume,
    unitLabel,
    setDbFeaturesAvailable,
  });

  // Stable list of active exercise IDs for sparklines
  const activeExerciseIds = useMemo(
    () => activeWorkout?.exercises.map((e) => e.exercise.id) ?? [],
    [activeWorkout]
  );

  // Sparkline trendlines -- only fetches when workout is active
  const exerciseTrendlines = useExerciseTrendlines(activeExerciseIds, userId, isWorkoutActive);

  const loadTemplates = useCallback(async (currentUserId: string) => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from("workout_templates")
      .select("id,name,primary_muscle_group")
      .eq("user_id", currentUserId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        setDbFeaturesAvailable(false);
      } else {
        toast.error(error.message);
      }
      setLoadingTemplates(false);
      return;
    }

    setDbFeaturesAvailable(true);
    setTemplates(data ?? []);
    setLoadingTemplates(false);
  }, [supabase]);

  // iOS Safari fallback: AudioContext cannot beep without a prior user gesture
  useEffect(() => {
    function handleRestComplete(e: Event) {
      const { exerciseName } =
        (e as CustomEvent<{ exerciseName: string }>).detail ?? {};
      toast(
        exerciseName ? `Rest complete -- ${exerciseName}` : "Rest period complete",
        { description: "Time to get back to it!", duration: 5000 }
      );
    }
    window.addEventListener("rest-timer-complete", handleRestComplete);
    return () => window.removeEventListener("rest-timer-complete", handleRestComplete);
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;
      setUserId(user.id);
      await loadTemplates(user.id);
    }

    init();

    return () => {
      active = false;
    };
  }, [loadTemplates, supabase]);

  useEffect(() => {
    try {
      const likeRaw = localStorage.getItem(TEMPLATE_LIKES_KEY);
      const nextLikes = likeRaw ? (JSON.parse(likeRaw) as string[]) : [];
      setLikedTemplateIds(new Set(nextLikes));
    } catch {
      setLikedTemplateIds(new Set());
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_LIKES_KEY, JSON.stringify(Array.from(likedTemplateIds)));
    } catch {
      // no-op
    }
  }, [likedTemplateIds]);

  // Fetch exercises from API with debounced search
  useEffect(() => {
    const controller = new AbortController();
    const seq = ++searchRequestSeq.current;

    const timeoutId = setTimeout(async () => {
      setLoadingExercises(true);

      try {
        const params = new URLSearchParams();
        const query = liftSearch.trim();

        if (query.length > 0) {
          params.set("query", query);
        }
        params.set("muscle_groups", selectedMuscleGroup);

        const response = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch exercises");

        const data = await response.json();

        if (seq !== searchRequestSeq.current) return;
        setApiExercises(data.exercises ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching exercises:", error);
        toast.error("Failed to load exercises from database");
      } finally {
        if (seq === searchRequestSeq.current) {
          setLoadingExercises(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort("Search cancelled");
    };
  }, [liftSearch, selectedMuscleGroup]);

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (template) {
      setWorkoutName(template.name);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    async function loadPreviousPerformance() {
      if (!userId || !activeWorkout) {
        setPreviousByExerciseId({});
        return;
      }

      const exerciseIds = activeWorkout.exercises.map(e => e.exercise.id);
      if (exerciseIds.length === 0) {
        setPreviousByExerciseId({});
        return;
      }

      const { data: completedSets, error } = await supabase
        .from("workout_sets")
        .select(
          "exercise_id,set_number,reps,weight_kg,completed_at,session_id,workout_sessions!inner(id,user_id,status,completed_at)"
        )
        .eq("workout_sessions.user_id", userId)
        .eq("workout_sessions.status", "completed")
        .not("completed_at", "is", null)
        .in("exercise_id", exerciseIds);

      if (error) {
        console.error("Error loading previous performance:", error);
        setPreviousByExerciseId({});
        return;
      }

      type WorkoutSessionLink = { completed_at: string | null };
      type CompletedSetRow = {
        exercise_id: string;
        set_number: number | null;
        reps: number | null;
        weight_kg: number | null;
        session_id: string;
        workout_sessions: WorkoutSessionLink | WorkoutSessionLink[] | null;
      };

      const rows = ((completedSets ?? []) as CompletedSetRow[])
        .map((row) => {
          const session = Array.isArray(row.workout_sessions)
            ? row.workout_sessions[0]
            : row.workout_sessions;
          return {
            ...row,
            completed_at: session?.completed_at ?? null,
          };
        })
        .filter((row) => row.completed_at != null)
        .filter((row) => row.session_id != null && row.set_number != null)
        .sort((a, b) => {
          const aCompleted = new Date(a.completed_at ?? 0).getTime();
          const bCompleted = new Date(b.completed_at ?? 0).getTime();
          if (aCompleted !== bCompleted) return bCompleted - aCompleted;
          const sessionCmp = String(b.session_id).localeCompare(String(a.session_id));
          if (sessionCmp !== 0) return sessionCmp;
          return (a.set_number ?? 0) - (b.set_number ?? 0);
        });

      const latestSessionByExercise = new Map<string, string>();
      for (const row of rows) {
        if (!latestSessionByExercise.has(row.exercise_id)) {
          latestSessionByExercise.set(row.exercise_id, row.session_id);
        }
      }

      const detailedByExercise: Record<
        string,
        Array<{ setNumber: number; reps: number | null; weight: number | null }>
      > = {};
      for (const row of rows) {
        const latestSessionId = latestSessionByExercise.get(row.exercise_id);
        if (!latestSessionId || row.session_id !== latestSessionId) continue;
        if (!detailedByExercise[row.exercise_id]) {
          detailedByExercise[row.exercise_id] = [];
        }
        detailedByExercise[row.exercise_id].push({
          setNumber: row.set_number ?? 0,
          reps: row.reps ?? null,
          weight: row.weight_kg ?? null,
        });
      }

      const byExercise: Record<string, Array<{ reps: number | null; weight: number | null }>> = {};
      for (const exerciseId of Object.keys(detailedByExercise)) {
        byExercise[exerciseId] = detailedByExercise[exerciseId]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((set) => ({ reps: set.reps, weight: set.weight }));
      }

      setPreviousByExerciseId(byExercise);
    }

    void loadPreviousPerformance();
  }, [activeWorkout, supabase, userId]);

  useEffect(() => {
    async function loadPickerPerformance() {
      if (!userId || filteredExercises.length === 0) {
        setExerciseLastPerformance({});
        return;
      }

      const ids = filteredExercises.slice(0, 120).map((exercise) => exercise.id);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("user_exercise_last_performance")
        .select("exercise_id,best_set,last_performed_at")
        .eq("user_id", userId)
        .in("exercise_id", ids);

      if (error) return;

      const map: Record<string, { reps: number | null; weight: number | null; performedAt: string | null }> = {};
      for (const row of data ?? []) {
        const best = row.best_set as { reps?: number | null; weight_kg?: number | null };
        map[row.exercise_id] = {
          reps: best?.reps ?? null,
          weight: best?.weight_kg ?? null,
          performedAt: row.last_performed_at ?? null,
        };
      }
      setExerciseLastPerformance(map);
    }

    void loadPickerPerformance();
  }, [filteredExercises, supabase, userId]);

  function getPrimaryBenefit(exercise: Exercise) {
    const group = MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ?? exercise.muscle_group;
    if (exercise.category === "compound") return `Build maximal ${group.toLowerCase()} strength with full-body coordination.`;
    if (exercise.category === "cardio") return `Increase conditioning capacity and repeat-effort endurance.`;
    if (exercise.category === "stretch") return `Improve mobility quality and position control for safer loading.`;
    return `Target ${group.toLowerCase()} with precision for hypertrophy and weak-point development.`;
  }

  function getCoachingCues(exercise: Exercise) {
    if (exercise.form_tips?.length) return exercise.form_tips;
    if (exercise.instructions) {
      return exercise.instructions
        .split(/\n+|\. /)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2);
    }
    return [];
  }

  // Auto-start workout when coming from launcher or adaptive
  useEffect(() => {
    if (hasAutoStarted || isWorkoutActive || loadingTemplates) return;

    const fromLauncher = searchParams.get('from_launcher');
    const fromAdaptive = searchParams.get('from_adaptive');
    if (!fromLauncher && !fromAdaptive) return;

    const templateId = searchParams.get('template_id');
    async function autoStart() {
      setHasAutoStarted(true);

      if (templateId && templates.length > 0) {
        const template = templates.find(t => t.id === templateId);
        if (!template) {
          console.error('Template not found:', templateId);
          toast.error('Template not found');
          return;
        }

        setSelectedTemplateId(templateId);
        setWorkoutName(template.name);
        startWorkout(template.name, userId!, templateId);

        try {
          const { data: templateExercises, error } = await supabase
            .from("template_exercises")
            .select(
              "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
            )
            .eq("template_id", templateId)
            .order("sort_order", { ascending: true });

          if (error) throw error;

          for (const row of templateExercises ?? []) {
            const exercise = row.exercises as unknown as Exercise | null;
            if (!exercise) continue;

            addExercise(exercise);

            const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
            if (!exerciseIndex) continue;

            const index = exerciseIndex - 1;
            const setsToCreate = Math.max(1, row.target_sets ?? 1);
            const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;

            updateSet(index, 0, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: row.target_weight_kg ?? null,
              rest_seconds: row.rest_seconds ?? 90,
            });

            for (let i = 1; i < setsToCreate; i += 1) {
              addSet(index);
              updateSet(index, i, {
                reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
                weight_kg: row.target_weight_kg ?? null,
                rest_seconds: row.rest_seconds ?? 90,
              });
            }
          }

          const source = fromAdaptive ? 'adaptive system' : 'launcher';
          await applyAutofillFromHistory();
          toast.success(`Started ${template.name} from ${source}`);
        } catch (error) {
          console.error('Template load error:', error);
          toast.error('Failed to load template');
        }
        return;
      }

      const storageKey = fromAdaptive ? 'adaptive_workout' : 'launcher_prediction';
      const workoutDataRaw = sessionStorage.getItem(storageKey);
      if (!workoutDataRaw) return;

      try {
        const launcherData = JSON.parse(workoutDataRaw);
        sessionStorage.removeItem(storageKey);

        setWorkoutName(launcherData.template_name);
        startWorkout(launcherData.template_name, userId!, undefined);

        for (const launcherEx of launcherData.exercises ?? []) {
          const exerciseData = launcherEx.exercise;
          if (!exerciseData) continue;

          const exercise = allExercises.find(ex => ex.name === exerciseData.name);
          if (!exercise) {
            console.warn(`Exercise not found: ${exerciseData.name}`);
            continue;
          }

          addExercise(exercise);

          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;

          const index = exerciseIndex - 1;
          const setsToCreate = launcherEx.target_sets || 3;
          const lastSet = launcherEx.last_performance?.[0];
          const targetReps = lastSet?.reps || launcherEx.target_reps || 10;
          const targetWeight = lastSet?.weight_kg || launcherEx.target_weight_kg || null;

          updateSet(index, 0, {
            reps: targetReps,
            weight_kg: targetWeight,
            rest_seconds: 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: targetReps,
              weight_kg: targetWeight,
              rest_seconds: 90,
            });
          }
        }

        await applyAutofillFromHistory();
        toast.success(`Started ${launcherData.template_name} from launcher`);
      } catch (error) {
        console.error('Preset load error:', error);
        sessionStorage.removeItem('launcher_prediction');
      }
    }

    autoStart();
  }, [searchParams, templates, loadingTemplates, isWorkoutActive, hasAutoStarted, startWorkout, addExercise, updateSet, addSet, allExercises, supabase]);

  function handlePresetChange(value: WorkoutPresetId) {
    setPresetId(value);
    if (value === "custom") return;

    const preset = POPULAR_WORKOUTS.find((item) => item.id === value);
    if (preset) {
      setWorkoutName(preset.defaultName);
    }
  }

  function handleToggleTemplateLike(templateId: string) {
    setLikedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  // Template CRUD actions (extracted hook)
  const {
    templateActionBusyId,
    handleSendTemplate,
    handleEditTemplate,
    handleCopyTemplate,
    handleDeleteTemplate,
  } = useTemplateActions({
    supabase,
    userId,
    loadTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    setLikedTemplateIds,
    loadWorkoutForEdit,
    addExercise,
    updateSet,
    addSet,
    setSendingTemplate,
    setSendDialogOpen,
  });

  const EXERCISE_SELECT_COLS =
    "id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url";

  function exerciseKey(ex: Exercise) {
    return `${ex.name}::${ex.muscle_group}`;
  }

  async function ensureExerciseRecord(exercise: Exercise) {
    const candidateSlug = `${slugify(exercise.name)}-${exercise.muscle_group}`;

    const { data: bySlug, error: slugError } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (slugError) {
      if (isMissingTableError(slugError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
    }

    if (bySlug) return bySlug as unknown as Exercise;

    const { data: byName } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .eq("name", exercise.name)
      .eq("muscle_group", exercise.muscle_group)
      .limit(1)
      .maybeSingle();

    if (byName) return byName as unknown as Exercise;

    if (!userId) throw new Error("No user found.");

    const { data: inserted, error: insertError } = await supabase
      .from("exercises")
      .insert({
        name: exercise.name,
        slug: candidateSlug,
        muscle_group: exercise.muscle_group,
        equipment: normalizeEquipment(exercise.equipment),
        category: exercise.category,
        instructions: exercise.instructions,
        form_tips: exercise.form_tips,
        image_url: exercise.image_url,
        is_custom: true,
        created_by: userId,
      })
      .select(EXERCISE_SELECT_COLS)
      .single();

    if (insertError) {
      if (isMissingTableError(insertError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
      const { data: reFetch } = await supabase
        .from("exercises")
        .select(EXERCISE_SELECT_COLS)
        .eq("slug", candidateSlug)
        .maybeSingle();
      if (reFetch) return reFetch as unknown as Exercise;
      return exercise;
    }

    return inserted as unknown as Exercise;
  }

  /** Batch-resolve exercises: 2-3 DB queries instead of N*2 sequential. */
  async function ensureExerciseRecordsBatch(
    exercises: Exercise[]
  ): Promise<Map<string, Exercise>> {
    const results = new Map<string, Exercise>();
    if (!exercises.length) return results;

    // Build slug → original exercise mapping
    const slugToOriginal = new Map<string, Exercise>();
    for (const ex of exercises) {
      slugToOriginal.set(`${slugify(ex.name)}-${ex.muscle_group}`, ex);
    }

    // Step 1: Batch lookup by slug (single query)
    const slugs = [...slugToOriginal.keys()];
    const { data: bySlug, error: slugError } = await supabase
      .from("exercises")
      .select(EXERCISE_SELECT_COLS)
      .in("slug", slugs);

    if (slugError && isMissingTableError(slugError)) {
      setDbFeaturesAvailable(false);
      for (const ex of exercises) results.set(exerciseKey(ex), ex);
      return results;
    }

    for (const row of bySlug ?? []) {
      const original = slugToOriginal.get((row as any).slug);
      if (original) results.set(exerciseKey(original), row as unknown as Exercise);
    }

    // Step 2: For unfound, batch lookup by name (single query)
    const unfound = exercises.filter((ex) => !results.has(exerciseKey(ex)));
    if (unfound.length) {
      const names = [...new Set(unfound.map((ex) => ex.name))];
      const { data: byName } = await supabase
        .from("exercises")
        .select(EXERCISE_SELECT_COLS)
        .in("name", names);

      const nameGroupIndex = new Map<string, Exercise>();
      for (const row of byName ?? []) {
        const r = row as unknown as Exercise;
        nameGroupIndex.set(`${r.name}::${r.muscle_group}`, r);
      }
      for (const ex of unfound) {
        const found = nameGroupIndex.get(exerciseKey(ex));
        if (found) results.set(exerciseKey(ex), found);
      }
    }

    // Step 3: For still unfound, batch insert
    const stillUnfound = exercises.filter((ex) => !results.has(exerciseKey(ex)));
    if (stillUnfound.length && userId) {
      const toInsert = stillUnfound.map((ex) => ({
        name: ex.name,
        slug: `${slugify(ex.name)}-${ex.muscle_group}`,
        muscle_group: ex.muscle_group,
        equipment: normalizeEquipment(ex.equipment),
        category: ex.category,
        instructions: ex.instructions,
        form_tips: ex.form_tips,
        image_url: ex.image_url,
        is_custom: true,
        created_by: userId,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("exercises")
        .insert(toInsert)
        .select(EXERCISE_SELECT_COLS);

      if (insertError) {
        if (isMissingTableError(insertError)) {
          setDbFeaturesAvailable(false);
          for (const ex of stillUnfound) results.set(exerciseKey(ex), ex);
          return results;
        }
        // Race condition: re-fetch by slugs
        const conflictSlugs = stillUnfound.map(
          (ex) => `${slugify(ex.name)}-${ex.muscle_group}`
        );
        const { data: reFetched } = await supabase
          .from("exercises")
          .select(EXERCISE_SELECT_COLS)
          .in("slug", conflictSlugs);
        for (const row of reFetched ?? []) {
          const original = slugToOriginal.get((row as any).slug);
          if (original) results.set(exerciseKey(original), row as unknown as Exercise);
        }
        for (const ex of stillUnfound) {
          if (!results.has(exerciseKey(ex))) results.set(exerciseKey(ex), ex);
        }
      } else {
        for (const row of inserted ?? []) {
          const original = slugToOriginal.get((row as any).slug);
          if (original) results.set(exerciseKey(original), row as unknown as Exercise);
        }
      }
    } else {
      for (const ex of stillUnfound) results.set(exerciseKey(ex), ex);
    }

    return results;
  }

  async function addExerciseToWorkout(
    exercise: Exercise,
    options?: {
      targetSets?: number | null;
      targetReps?: string | null;
      targetWeight?: number | null;
      restSeconds?: number | null;
      silent?: boolean;
    }
  ) {
    const source = await ensureExerciseRecord(exercise);

    if (selectedExerciseIds.has(source.id)) {
      if (!options?.silent) toast.message(`${source.name} is already in this session`);
      return;
    }

    addExercise(source);

    const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
    if (!exerciseIndex) return;

    const index = exerciseIndex - 1;

    const setsToCreate = Math.max(1, options?.targetSets ?? 1);
    const parsedReps = options?.targetReps ? Number.parseInt(options.targetReps, 10) : null;

    updateSet(index, 0, {
      reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
      weight_kg: options?.targetWeight ?? null,
      rest_seconds: options?.restSeconds ?? 90,
    });

    for (let i = 1; i < setsToCreate; i += 1) {
      addSet(index);
      updateSet(index, i, {
        reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
        weight_kg: options?.targetWeight ?? null,
        rest_seconds: options?.restSeconds ?? 90,
      });
    }

    if (!options?.silent) toast.success(`Added ${source.name}`);
  }

  /**
   * Smart autofill: after all exercises are added to the active workout,
   * pre-fill each set's reps from the user's last session and bump the weight
   * by a standard plate increment. Only fires once per workout start.
   */
  async function applyAutofillFromHistory() {
    if (!userId) return;
    const snapshot = useWorkoutStore.getState().activeWorkout;
    if (!snapshot || snapshot.exercises.length === 0) return;

    const exIds = snapshot.exercises.map((e) => e.exercise.id);

    type PrevRow = {
      exercise_id: string;
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
      session_id: string;
      workout_sessions:
        | { completed_at: string | null }
        | { completed_at: string | null }[]
        | null;
    };

    const { data: prevData } = await supabase
      .from("workout_sets")
      .select(
        "exercise_id,set_number,reps,weight_kg,session_id,workout_sessions!inner(user_id,status,completed_at)"
      )
      .eq("workout_sessions.user_id", userId)
      .eq("workout_sessions.status", "completed")
      .not("workout_sessions.completed_at", "is", null)
      .in("exercise_id", exIds);

    if (!prevData || prevData.length === 0) return;

    const rows = (prevData as PrevRow[])
      .map((row) => {
        const sess = Array.isArray(row.workout_sessions)
          ? row.workout_sessions[0]
          : row.workout_sessions;
        return { ...row, completed_at: sess?.completed_at ?? null };
      })
      .filter((r) => r.completed_at != null)
      .sort((a, b) => {
        const ta = new Date(a.completed_at!).getTime();
        const tb = new Date(b.completed_at!).getTime();
        return ta !== tb
          ? tb - ta
          : String(b.session_id).localeCompare(String(a.session_id));
      });

    const latestSession = new Map<string, string>();
    for (const r of rows) {
      if (!latestSession.has(r.exercise_id)) latestSession.set(r.exercise_id, r.session_id);
    }

    const byEx: Record<string, Array<{ setNumber: number; reps: number | null; weight: number | null }>> = {};
    for (const r of rows) {
      if (latestSession.get(r.exercise_id) !== r.session_id) continue;
      if (!byEx[r.exercise_id]) byEx[r.exercise_id] = [];
      byEx[r.exercise_id].push({ setNumber: r.set_number, reps: r.reps, weight: r.weight_kg });
    }
    for (const sets of Object.values(byEx)) {
      sets.sort((a, b) => a.setNumber - b.setNumber);
    }

    const { preference: pref } = useUnitPreferenceStore.getState();

    snapshot.exercises.forEach((exBlock, exIdx) => {
      const prevSets = byEx[exBlock.exercise.id];
      if (!prevSets) return;
      exBlock.sets.forEach((set, setIdx) => {
        if (set.completed) return;
        const prev = prevSets[setIdx];
        if (!prev) return;
        const updates: Partial<WorkoutSet> = {};
        if (prev.reps != null) updates.reps = prev.reps;
        if (prev.weight != null) updates.weight_kg = calcSuggestedWeight(prev.weight, pref);
        if (Object.keys(updates).length > 0) updateSet(exIdx, setIdx, updates);
      });
    });
  }

  async function handleStartWorkout() {
    const name = workoutName.trim() || "Workout";
    const activeTemplateId = selectedTemplateId === "none" ? undefined : selectedTemplateId;

    if (setupTab === "templates") {
      if (activeTemplateId) {
        const tpl = templates.find((t) => t.id === activeTemplateId);
        const categoryToUse = tpl?.primary_muscle_group ?? (pendingCategories.length > 0 ? pendingCategories.join(",") : null);
        if (!categoryToUse) {
          toast.error("Please select a workout type before starting.");
          return;
        }
        if (!tpl?.primary_muscle_group && pendingCategories.length > 0) {
          const joined = pendingCategories.join(",");
          await supabase
            .from("workout_templates")
            .update({ primary_muscle_group: joined })
            .eq("id", activeTemplateId);
          setTemplates((prev) =>
            prev.map((t) => t.id === activeTemplateId ? { ...t, primary_muscle_group: joined } : t)
          );
        }
      } else {
        if (pendingCategories.length === 0) {
          toast.error("Please select a workout type before starting.");
          return;
        }
      }
    }

    if (!userId) return;
    startWorkout(name, userId, activeTemplateId);
    if (userId) {
      void trackSessionIntentSet(supabase, userId, {
        workout_name: name,
        template_id: activeTemplateId ?? null,
        source: activeTemplateId ? "template" : presetId,
      });
    }

    try {
      if (activeTemplateId) {
        const { data: templateExercises, error } = await supabase
          .from("template_exercises")
          .select(
            "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
          )
          .eq("template_id", activeTemplateId)
          .order("sort_order", { ascending: true });

        if (error) {
          if (isMissingTableError(error)) {
            setDbFeaturesAvailable(false);
            toast.message(
              "Templates are unavailable until Supabase migrations are applied. Starting empty session."
            );
            return;
          }
          throw error;
        }

        const rawExercises = (templateExercises ?? [])
          .map((row) => ({ exercise: row.exercises as unknown as Exercise | null, row }))
          .filter((r): r is { exercise: Exercise; row: typeof templateExercises extends (infer T)[] | null ? T : never } => r.exercise != null);

        const resolved = await ensureExerciseRecordsBatch(rawExercises.map((r) => r.exercise));

        for (const { exercise, row } of rawExercises) {
          const source = resolved.get(exerciseKey(exercise)) ?? exercise;
          if (selectedExerciseIds.has(source.id)) continue;

          addExercise(source);
          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;
          const index = exerciseIndex - 1;

          const setsToCreate = Math.max(1, row.target_sets ?? 1);
          const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;

          updateSet(index, 0, {
            reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            weight_kg: row.target_weight_kg ?? null,
            rest_seconds: row.rest_seconds ?? 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: row.target_weight_kg ?? null,
              rest_seconds: row.rest_seconds ?? 90,
            });
          }
        }

        await applyAutofillFromHistory();
        toast.success(`Started ${name} from saved template`);
        return;
      }

      if (presetId !== "custom") {
        const preset = POPULAR_WORKOUTS.find((item) => item.id === presetId);
        const liftsWithExercises = (preset?.lifts ?? [])
          .map((lift) => ({ lift, exercise: allExercises.find((item) => item.name === lift.name) }))
          .filter((r): r is { lift: typeof r.lift; exercise: Exercise } => r.exercise != null);

        const resolved = await ensureExerciseRecordsBatch(liftsWithExercises.map((r) => r.exercise));

        for (const { lift, exercise } of liftsWithExercises) {
          const source = resolved.get(exerciseKey(exercise)) ?? exercise;
          if (selectedExerciseIds.has(source.id)) continue;

          addExercise(source);
          const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
          if (!exerciseIndex) continue;
          const index = exerciseIndex - 1;

          const setsToCreate = Math.max(1, lift.sets ?? 1);
          const parsedReps = lift.reps ? Number.parseInt(lift.reps, 10) : null;

          updateSet(index, 0, {
            reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            weight_kg: null,
            rest_seconds: 90,
          });

          for (let i = 1; i < setsToCreate; i += 1) {
            addSet(index);
            updateSet(index, i, {
              reps: Number.isFinite(parsedReps as number) ? parsedReps : null,
              weight_kg: null,
              rest_seconds: 90,
            });
          }
        }
      }

      await applyAutofillFromHistory();
      toast.success(`Started ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workout source";
      toast.error(message);
    }
  }

  async function handleAddSelectedExercise() {
    if (!selectedExercise) {
      toast.error("Choose a lift first.");
      return;
    }

    try {
      await addExerciseToWorkout(selectedExercise);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add exercise.";
      toast.error(message);
    }
  }

  async function handleCreateCustomExercise() {
    const name = customName.trim();
    if (name.length < 3) {
      toast.error("Custom lift name must be at least 3 characters.");
      return;
    }

    const duplicate = allExercises.find(
      (exercise) =>
        exercise.muscle_group === customMuscleGroup &&
        exercise.name.toLowerCase() === name.toLowerCase()
    );

    try {
      if (duplicate) {
        await addExerciseToWorkout(duplicate);
        setCustomName("");
        toast.message("That lift already exists, added it to your workout.");
        return;
      }

      const customExercise = makeCustomExercise(name, customMuscleGroup, customEquipment);
      setCustomExercises((current) => [customExercise, ...current]);
      await addExerciseToWorkout(customExercise);

      setSelectedMuscleGroup(customMuscleGroup);
      setSelectedExerciseId(customExercise.id);
      setCustomName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create custom lift.";
      toast.error(message);
    }
  }

  function handleOpenSaveTemplate() {
    if (!activeWorkout || !userId) {
      toast.error("Start a workout first.");
      return;
    }
    setSaveTemplateDialogOpen(true);
  }

  async function handleSaveTemplate(templateName: string, isPublic: boolean, difficulty: string = "grind", categories: string[] = []) {
    if (!activeWorkout || !userId) {
      toast.error("Start a workout first.");
      return;
    }

    try {
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to ensure profile exists:", err);
    }

    const { data: createdTemplate, error: templateError } = await supabase
      .from("workout_templates")
      .insert({
        user_id: userId,
        name: templateName.trim(),
        description: `Saved from ${activeWorkout.name}`,
        is_public: isPublic,
        difficulty_level: difficulty,
        primary_muscle_group: categories.length > 0 ? categories.join(",") : null,
      })
      .select("id")
      .single();

    if (templateError || !createdTemplate) {
      if (templateError && isMissingTableError(templateError)) {
        setDbFeaturesAvailable(false);
        toast.error("Template tables are missing in Supabase. Run migrations first.");
        return;
      }
      toast.error(templateError?.message ?? "Could not save template.");
      return;
    }

    const rows = activeWorkout.exercises.map((exerciseBlock, index) => {
      const firstSet = exerciseBlock.sets[0];
      return {
        template_id: createdTemplate.id,
        exercise_id: exerciseBlock.exercise.id,
        sort_order: index,
        target_sets: exerciseBlock.sets.length,
        target_reps: firstSet?.reps ? String(firstSet.reps) : null,
        target_weight_kg: firstSet?.weight_kg ?? null,
        rest_seconds: firstSet?.rest_seconds ?? 90,
      };
    });

    const { error: rowError } = await supabase.from("template_exercises").insert(rows);

    if (rowError) {
      if (isMissingTableError(rowError)) {
        setDbFeaturesAvailable(false);
        toast.error("Template tables are missing in Supabase. Run migrations first.");
        return;
      }
      toast.error(rowError.message);
      return;
    }

    toast.success("Template saved.");
    await loadTemplates(userId);
  }

  // Rest timer handler for ExerciseCard
  const handleStartRest = useCallback(
    (exerciseId: string, exerciseName: string, seconds: number) => {
      const activeTimers = getActiveTimers();
      for (const timer of activeTimers) {
        stopTimer(timer.id);
      }
      startTimer(exerciseId, exerciseName, seconds);
    },
    [getActiveTimers, stopTimer, startTimer]
  );

  // Shared inner content for the lift picker
  const liftPickerExerciseList = (
    <>
      <Input
        value={liftSearch}
        onChange={(event) => setLiftSearch(event.target.value)}
        placeholder="Type to search lifts"
        className="mb-2"
        autoFocus
      />
      <ScrollArea className="h-96">
        <div className="space-y-2 pr-2">
          {loadingExercises ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Loading exercises...
            </p>
          ) : filteredExercises.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No lifts found for this filter.
            </p>
          ) : (
            filteredExercises.map((exercise) => {
              const mediaUrl = resolveExerciseMediaUrl(
                ("gif_url" in exercise && exercise.gif_url)
                  ? exercise.gif_url
                  : exercise.image_url,
                ("source" in exercise
                  ? (exercise as { source?: string | null }).source
                  : null) ?? null
              );
              return (
                <ExerciseSelectionCard
                  key={exercise.id}
                  exercise={exercise}
                  mediaUrl={mediaUrl}
                  posterUrl={resolveExerciseMediaUrl(
                    exercise.image_url,
                    ("source" in exercise
                      ? (exercise as { source?: string | null }).source
                      : null) ?? null
                  )}
                  selected={selectedExerciseId === exercise.id}
                  primaryBenefit={getPrimaryBenefit(exercise)}
                  coachingCues={getCoachingCues(exercise)}
                  previousPerformance={exerciseLastPerformance[exercise.id] ?? null}
                  onSelect={() => {
                    setSelectedExerciseId(exercise.id);
                  }}
                  onQuickAdd={async () => {
                    setSelectedExerciseId(exercise.id);
                    await addExerciseToWorkout(exercise);
                  }}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div data-phase="active" className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold tracking-tight">Workout</p>
          </div>
          {isWorkoutActive && activeWorkout ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              {plannerStats.completedSets}/{plannerStats.totalSets} sets
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-6 md:px-6 lg:px-10">
        {!isWorkoutActive ? (
          <PageHeader
            title="Workout"
            subtitle="Save templates, reuse them in future sessions, and compare to previous performance."
          />
        ) : null}

        {!isWorkoutActive ? (
          <Card className="mx-auto w-full max-w-3xl overflow-hidden border-primary/25 bg-card/95 shadow-xl transition-all duration-300">
            <div className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">New Session</p>
                  <p className="text-xl font-black tracking-tight">Start a Workout</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 p-5 sm:p-6">
              {!dbFeaturesAvailable ? (
                <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                  Supabase workout tables were not found. You can still add exercises and train now,
                  but templates/history sync will be limited until migrations are applied.
                </p>
              ) : null}

              <div className="rounded-xl border border-border/70 bg-secondary/20 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => { setSetupTab("templates"); setQuickFilter("All"); }}
                    className={`h-9 rounded-lg text-xs font-semibold transition ${setupTab === "templates"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/70"
                      }`}
                  >
                    My Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupTab("quick");
                      setSelectedTemplateId("none");
                      setPendingCategories([]);
                      setQuickFilter("All");
                    }}
                    className={`h-9 rounded-lg text-xs font-semibold transition ${setupTab === "quick"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/70"
                      }`}
                  >
                    Quick Start
                  </button>
                </div>
              </div>

              {setupTab === "templates" ? (
                <TemplateManagerPanel
                  templates={templates}
                  loadingTemplates={loadingTemplates}
                  selectedTemplateId={selectedTemplateId}
                  showTemplateManager={showTemplateManager}
                  templateActionBusyId={templateActionBusyId}
                  likedTemplateIds={likedTemplateIds}
                  onToggleManager={() => setShowTemplateManager((prev) => !prev)}
                  onSelectTemplate={(id, name) => {
                    setSelectedTemplateId(id);
                    setWorkoutName(name);
                    setPendingCategories([]);
                  }}
                  onSelectStartFresh={() => setSelectedTemplateId("none")}
                  onSendTemplate={handleSendTemplate}
                  onEditTemplate={handleEditTemplate}
                  onCopyTemplate={handleCopyTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onToggleLike={handleToggleTemplateLike}
                />
              ) : (
                <QuickStartPanel
                  presetId={presetId}
                  quickFilter={quickFilter}
                  onQuickFilterChange={setQuickFilter}
                  onPresetChange={handlePresetChange}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="workout-name" className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Session Name</Label>
                <Input
                  id="workout-name"
                  value={workoutName}
                  onChange={(event) => setWorkoutName(event.target.value)}
                  placeholder="Workout name"
                />
              </div>

              {/* Category picker -- required when a saved template has no workout type OR Start Fresh */}
              {setupTab === "templates" && (() => {
                if (selectedTemplateId !== "none") {
                  const tpl = templates.find((t) => t.id === selectedTemplateId);
                  if (tpl?.primary_muscle_group) return null;
                }
                const categoryOptions = MUSCLE_FILTERS.filter((f) => f !== "All");
                const isStartFresh = selectedTemplateId === "none";
                return (
                  <div className={`space-y-2 rounded-xl border p-3 ${isStartFresh
                    ? "border-border/70 bg-secondary/20"
                    : "border-amber-500/40 bg-amber-500/5"
                    }`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${isStartFresh ? "text-muted-foreground" : "text-amber-400"
                      }`}>
                      {isStartFresh ? "Workout Type" : "Workout Type Required"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isStartFresh
                        ? "Choose a category for your session."
                        : "Select a category to continue. This will be saved to your template."}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {categoryOptions.map((cat) => {
                        const lc = cat.toLowerCase();
                        const cgc = getMuscleColor(lc);
                        const active = pendingCategories.includes(lc);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              setPendingCategories((prev) =>
                                active ? prev.filter((c) => c !== lc) : [...prev, lc]
                              )
                            }
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-all"
                            style={active ? {
                              background: cgc.bgAlpha,
                              color: cgc.labelColor,
                              border: `1.5px solid ${cgc.borderAlpha}`,
                              boxShadow: `0 0 8px ${cgc.from}33`,
                            } : {
                              background: "transparent",
                              color: "var(--muted-foreground)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <Button
                className="h-11 w-full text-base font-semibold"
                onClick={handleStartWorkout}
                disabled={
                  ghostIsLoading ||
                  (setupTab === "templates" &&
                    pendingCategories.length === 0 &&
                    (selectedTemplateId === "none" ||
                      !templates.find((t) => t.id === selectedTemplateId)?.primary_muscle_group))
                }
              >
                {ghostIsLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Start Workout
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isWorkoutActive && activeWorkout ? (
          <>
            <WorkoutHeader
              workoutName={activeWorkout.name}
              startedAt={activeWorkout.started_at}
              totalVolumeDisplay={toDisplayVolume(plannerStats.totalVolumeKg).toLocaleString()}
              completedSets={plannerStats.completedSets}
              totalSets={plannerStats.totalSets}
              exerciseCount={plannerStats.exercises}
              completionProgressPct={completionProgressPct}
              unitLabel={unitLabel}
            />

            <div className="grid gap-6 lg:grid-cols-[21.25rem_minmax(0,1fr)]">
              <Card className="h-fit border-border/70 bg-card/95 shadow-sm transition-all duration-300 lg:sticky lg:top-20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={activeWorkout.name}
                      onChange={(e) => updateWorkoutName(e.target.value)}
                      className="h-9 flex-1 border-transparent bg-transparent px-0 text-[22px] font-semibold leading-tight tracking-tight focus:border-border focus:bg-background"
                      placeholder="Workout name"
                    />
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                      <Clock3 className="size-4" />
                      <ElapsedTime startedAt={activeWorkout.started_at} />
                    </span>
                  </div>
                  {activeWorkout.template_id ? (
                    <p className="text-xs text-muted-foreground">Template session</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Muscle groups</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {MUSCLE_GROUPS.filter((g) => g !== "full_body").map((group) => {
                          const isSelected = selectedMuscleGroup === group;
                          return (
                            <button
                              key={group}
                              type="button"
                              onClick={() => {
                                setSelectedMuscleGroup(group);
                                setSelectedExerciseId("");
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all",
                                isSelected
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : "border-border/60 bg-card/40 text-muted-foreground"
                              )}
                            >
                              {MUSCLE_GROUP_LABELS[group]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Available lifts</Label>
                      {isSmallScreen ? (
                        <Sheet open={liftPickerOpen} onOpenChange={setLiftPickerOpen}>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            onClick={() => setLiftPickerOpen(true)}
                          >
                            <span className="truncate">
                              {selectedExercise ? selectedExercise.name : "Search and choose a lift"}
                            </span>
                            <ChevronDown className="ml-2 size-4 shrink-0 opacity-70" />
                          </Button>
                          <SheetContent side="bottom" className="h-[72dvh] flex flex-col">
                            <SheetHeader>
                              <SheetTitle>Choose a lift</SheetTitle>
                            </SheetHeader>
                            <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
                              {liftPickerExerciseList}
                            </div>
                          </SheetContent>
                        </Sheet>
                      ) : (
                        <Popover open={liftPickerOpen} onOpenChange={setLiftPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              <span className="truncate">
                                {selectedExercise ? selectedExercise.name : "Search and choose a lift"}
                              </span>
                              <ChevronDown className="ml-2 size-4 shrink-0 opacity-70" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-2" align="start">
                            {liftPickerExerciseList}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>

                  {selectedExercise ? (
                    <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{selectedExercise.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {MUSCLE_GROUP_LABELS[selectedExercise.muscle_group as MuscleGroup] ?? selectedExercise.muscle_group}
                            {selectedExercise.equipment
                              ? ` \u00b7 ${EQUIPMENT_LABELS[selectedExercise.equipment] ?? selectedExercise.equipment}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="mt-3 w-full"
                        onClick={handleAddSelectedExercise}
                      >
                        <Plus className="mr-2 size-4" />
                        Add Selected Lift
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleAddSelectedExercise}
                      disabled
                    >
                      <Plus className="mr-2 size-4" />
                      Add Selected Lift
                    </Button>
                  )}

                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Create custom lift</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="custom-lift-name">Lift name</Label>
                        <Input
                          id="custom-lift-name"
                          value={customName}
                          onChange={(event) => setCustomName(event.target.value)}
                          placeholder="Ex: Cable Y Raise"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Muscle group</Label>
                          <Select
                            value={customMuscleGroup}
                            onValueChange={(value) => setCustomMuscleGroup(value as MuscleGroup)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select muscle group" />
                            </SelectTrigger>
                            <SelectContent>
                              {MUSCLE_GROUPS.map((group) => (
                                <SelectItem key={group} value={group}>
                                  {MUSCLE_GROUP_LABELS[group]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Equipment</Label>
                          <Select value={customEquipment} onValueChange={setCustomEquipment}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={handleCreateCustomExercise}
                      >
                        Create and Add Custom Lift
                      </Button>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 bg-card/90">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[20px] font-bold tracking-tight">Exercises</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeWorkout.exercises.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-10 text-center">
                        <p className="text-[20px] font-semibold tracking-tight text-foreground">
                          Build the session that builds you.
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose your first exercise to enter training mode.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {ghostWorkoutData ? (
                          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                            Ghost workout active. You are training against your last matching session.
                          </div>
                        ) : null}
                        {activeWorkout.exercises.map((exerciseBlock, exerciseIndex) => (
                          <ExerciseCard
                            key={exerciseBlock.exercise.id}
                            exerciseBlock={exerciseBlock}
                            exerciseIndex={exerciseIndex}
                            ghostSets={ghostWorkoutData?.exercises[exerciseBlock.exercise.id]}
                            previousSets={previousByExerciseId[exerciseBlock.exercise.id]}
                            suggestedWeights={suggestedWeightsByKey[exerciseBlock.exercise.id]}
                            trendline={exerciseTrendlines[exerciseBlock.exercise.id]}
                            preference={preference}
                            onUpdateSet={updateSet}
                            onCompleteSet={completeSet}
                            onRemoveSet={removeSet}
                            onAddSet={addSet}
                            onRemoveExercise={removeExercise}
                            onSwapExercise={setSwapSheetIndex}
                            onSetExerciseNote={setExerciseNote}
                            onStartRest={handleStartRest}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/95 shadow-sm lg:sticky lg:top-20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Session Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Workout Notes */}
                    <div className="space-y-1.5 pb-3 border-b border-border/40">
                      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <NotebookPen className="h-3 w-3" />
                        Workout notes
                      </Label>
                      <Textarea
                        placeholder="How did the session feel? Any PRs or observations..."
                        value={activeWorkout.notes}
                        onChange={(e) => setWorkoutNote(e.target.value)}
                        className="min-h-[72px] resize-none text-sm"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleOpenSaveTemplate}
                      >
                        <Save className="mr-2 size-4" />
                        Save Template
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleCancelWorkout}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="transition-all duration-200 hover:scale-[1.01]"
                        onClick={handleFinishWorkout}
                      >
                        Finish Workout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}

        <SaveTemplateDialog
          open={saveTemplateDialogOpen}
          defaultName={activeWorkout?.name || ""}
          defaultCategories={(() => {
            if (!activeWorkout) return [];
            const groups = new Set<string>();
            for (const ex of activeWorkout.exercises) {
              if (ex.exercise.muscle_group) groups.add(ex.exercise.muscle_group);
            }
            return [...groups];
          })()}
          onClose={() => setSaveTemplateDialogOpen(false)}
          onSave={handleSaveTemplate}
        />

        <SendTemplateDialog
          open={sendDialogOpen}
          currentUserId={userId}
          template={sendingTemplate}
          onClose={() => {
            setSendDialogOpen(false);
            setSendingTemplate(null);
          }}
          onSend={async (recipientId, template, message) => {
            await sendTemplate(recipientId, template, message);
            toast.success("Template sent to shared mailbox");
          }}
        />

        {/* Workout Complete Celebration */}
        {showCelebration && celebrationStats && (
          <WorkoutCompleteCelebration
            stats={celebrationStats}
            confettiStyle="gold"
            onClose={handleCloseWorkoutCelebration}
          />
        )}

        {/* Level-Up Celebration -- shown after workout celebration closes */}
        {!showCelebration && levelUpData && (
          <LevelUpCelebration
            newLevel={levelUpData.newLevel}
            onClose={handleCloseLevelUp}
          />
        )}

        {/* Session RPE Prompt */}
        <WorkoutCompletionDialog
          open={sessionRpePromptOpen}
          onOpenChange={setSessionRpePromptOpen}
          sessionRpeValue={sessionRpeValue}
          onSessionRpeChange={setSessionRpeValue}
          onSave={handleSaveSessionRpe}
          saving={savingSessionRpe}
        />

        {/* Floating Rest Timer Pill */}
        <RestTimerPill />

        {/* AI Coach Voice Command Bar */}
        {AI_COACH_ENABLED && isWorkoutActive && <VoiceCommandBar />}

        {/* Exercise Swap Sheet */}
        <ExerciseSwapSheet
          open={swapSheetIndex !== null}
          exerciseIndex={swapSheetIndex}
          currentExercise={
            swapSheetIndex !== null
              ? (activeWorkout?.exercises[swapSheetIndex]?.exercise ?? null)
              : null
          }
          onSwap={handleSwapExercise}
          onClose={() => setSwapSheetIndex(null)}
        />
      </div>
    </div>
  );
}
```

---
## src/app/(app)/nutrition/page.tsx
```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Settings2,
  Plus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Apple,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Share2,
  BookmarkPlus,
} from "lucide-react";
import { addDays, subDays, format } from "date-fns";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { useSharedItems } from "@/hooks/use-shared-items";
import {
  trackNutritionCatchupCompleted,
  trackNutritionCatchupNudgeShown,
} from "@/lib/retention-events";
import { FoodLogCard } from "@/components/nutrition/food-log-card";
import { MealTemplateSheet } from "@/components/nutrition/meal-template-sheet";
import { Camera, Utensils, ShoppingCart } from "lucide-react";
import { MENU_SCANNER_ENABLED, FOOD_SCANNER_ENABLED, GROCERY_GENERATOR_ENABLED } from "@/lib/features";
import { SendMealDialog } from "@/components/social/send-meal-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { MacroRing } from "@/components/ui/macro-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { FoodItem, MealType, MealTemplateItem } from "@/types/nutrition";

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: MealType;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

type EntryNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
};

const mealConfig: Record<MealType, { label: string; Icon: React.ElementType; color: string }> = {
  breakfast: {
    label: "Breakfast",
    Icon: Coffee,
    color: "text-amber-400",
  },
  lunch: {
    label: "Lunch",
    Icon: Sun,
    color: "text-yellow-400",
  },
  dinner: {
    label: "Dinner",
    Icon: Moon,
    color: "text-blue-400",
  },
  snack: {
    label: "Snacks",
    Icon: Cookie,
    color: "text-pink-400",
  },
};

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

function getEntryNutrition(entry: FoodLogEntry): EntryNutrition {
  const servings = entry.servings ?? 1;
  const item = entry.food_items;

  return {
    calories:
      item?.calories_per_serving != null
        ? roundTo2(item.calories_per_serving * servings)
        : entry.calories_consumed ?? 0,
    protein:
      item?.protein_g != null
        ? roundTo2(item.protein_g * servings)
        : entry.protein_g ?? 0,
    carbs:
      item?.carbs_g != null
        ? roundTo2(item.carbs_g * servings)
        : entry.carbs_g ?? 0,
    fat:
      item?.fat_g != null
        ? roundTo2(item.fat_g * servings)
        : entry.fat_g ?? 0,
    fiber:
      item?.fiber_g != null ? roundTo2(item.fiber_g * servings) : 0,
    sugar:
      item?.sugar_g != null ? roundTo2(item.sugar_g * servings) : 0,
    sodiumMg:
      item?.sodium_mg != null ? roundTo2(item.sodium_mg * servings) : 0,
  };
}

function MacroChip({
  label,
  value,
  goal,
  unit = "g",
  colorClass,
}: {
  label: string;
  value: number;
  goal?: number | null;
  unit?: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 sm:gap-1 sm:rounded-xl sm:px-3 sm:py-2">
      <span className={`text-[10px] font-semibold uppercase tracking-wider sm:text-xs ${colorClass}`}>{label}</span>
      <span className="text-sm font-bold text-foreground sm:text-base">
        {Math.round(value)}
        <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">{unit}</span>
      </span>
      {goal != null && goal > 0 ? (
        <span className="text-[9px] text-muted-foreground sm:text-[10px]">
          / {Math.round(goal)}
          {unit}
        </span>
      ) : null}
    </div>
  );
}

function MealSection({
  meal,
  entries,
  getNutrition,
  onDelete,
  onEdit,
}: {
  meal: MealType;
  entries: FoodLogEntry[];
  getNutrition: (entry: FoodLogEntry) => EntryNutrition;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}) {
  const { label, Icon, color } = mealConfig[meal];
  const mealCalories = entries.reduce((sum, e) => sum + getNutrition(e).calories, 0);

  return (
    <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Icon className={`size-4 ${color}`} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            {entries.length > 0 ? (
              <p className="text-xs text-muted-foreground">{Math.round(mealCalories)} kcal</p>
            ) : null}
          </div>
        </div>
        <Link href={`/nutrition/scan?meal=${meal}`}>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
            <Plus className="size-3.5" />
            Add
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nothing logged yet</p>
        ) : (
          entries.map((entry) => (
            <FoodLogCard key={entry.id} entry={entry} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

type GoalData = {
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  fiber_g_target?: number | null;
};

export default function NutritionPage() {
  const supabase = useSupabase();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [goals, setGoals] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sendMealDialogOpen, setSendMealDialogOpen] = useState(false);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);

  const { sendMealDay } = useSharedItems(currentUserId);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;
        setCurrentUserId(user.id);

        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const localDayStart = new Date(selectedDate);
        localDayStart.setHours(0, 0, 0, 0);
        const localNextDayStart = new Date(localDayStart);
        localNextDayStart.setDate(localNextDayStart.getDate() + 1);

        const { data: rawEntries } = await supabase
          .from("food_log")
          .select(
            "id, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g, logged_at, food_items(id, name, brand, barcode, source, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_description, serving_size_g)"
          )
          .eq("user_id", user.id)
          .gte("logged_at", localDayStart.toISOString())
          .lt("logged_at", localNextDayStart.toISOString())
          .order("logged_at", { ascending: true });

        setEntries((rawEntries ?? []) as unknown as FoodLogEntry[]);

        const { data: goalsData } = await supabase
          .from("nutrition_goals")
          .select("*")
          .eq("user_id", user.id)
          .lte("effective_from", dateStr)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle();

        setGoals((goalsData ?? null) as GoalData | null);
      } catch (err) {
        console.error("Failed to load nutrition data:", err);
        toast.error("Failed to load nutrition data");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [selectedDate, supabase]);

  async function handleDelete(entryId: string) {
    const previousEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    try {
      const { error } = await supabase.from("food_log").delete().eq("id", entryId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to delete entry");
    }
  }

  async function handleEdit(entryId: string, updates: { meal_type: string; servings: number }) {
    const previousEntries = entries;
    const current = previousEntries.find((entry) => entry.id === entryId) ?? null;
    if (!current) return;

    const nextNutrition = getEntryNutrition({ ...current, servings: updates.servings });

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              meal_type: updates.meal_type as MealType,
              servings: updates.servings,
              calories_consumed: nextNutrition.calories,
              protein_g: nextNutrition.protein,
              carbs_g: nextNutrition.carbs,
              fat_g: nextNutrition.fat,
            }
          : e
      )
    );

    try {
      const { error } = await supabase
        .from("food_log")
        .update({
          meal_type: updates.meal_type,
          servings: updates.servings,
          calories_consumed: nextNutrition.calories,
          protein_g: nextNutrition.protein,
          carbs_g: nextNutrition.carbs,
          fat_g: nextNutrition.fat,
        })
        .eq("id", entryId);

      if (error) throw error;
    } catch (err) {
      console.error(err);
      setEntries(previousEntries);
      toast.error("Failed to update entry");
      throw err;
    }
  }

  const displayDate = format(selectedDate, "EEEE, MMMM d");

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const nutrition = getEntryNutrition(entry);
        acc.calories += nutrition.calories;
        acc.protein += nutrition.protein;
        acc.carbs += nutrition.carbs;
        acc.fat += nutrition.fat;
        acc.fiber += nutrition.fiber;
        acc.sugar += nutrition.sugar;
        acc.sodiumMg += nutrition.sodiumMg;
        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodiumMg: 0,
      }
    );
  }, [entries]);

  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const totalCarbs = totals.carbs;
  const totalFat = totals.fat;
  const totalFiber = totals.fiber;
  const totalSugar = totals.sugar;
  const totalSodiumMg = totals.sodiumMg;

  const mealGroups: Record<MealType, FoodLogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const entry of entries) {
    if (entry.meal_type in mealGroups) {
      mealGroups[entry.meal_type].push(entry);
    }
  }

  const calorieGoal = goals?.calories_target ?? null;
  const calorieProgress =
    calorieGoal != null && calorieGoal > 0
      ? Math.min((totalCalories / calorieGoal) * 100, 100)
      : null;
  const caloriesRemaining = calorieGoal != null ? calorieGoal - totalCalories : null;
  const isOver = caloriesRemaining != null && caloriesRemaining < 0;
  const proteinGoal = goals?.protein_g_target ?? null;
  const proteinRemaining = proteinGoal != null ? Math.max(0, proteinGoal - totalProtein) : null;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const hoursElapsed = Math.max(1, now.getHours() + now.getMinutes() / 60);
  const projectedProteinBy9pm =
    isToday && totalProtein > 0
      ? Math.round((totalProtein / hoursElapsed) * 21)
      : Math.round(totalProtein);
  const catchupNeeded = isToday && (proteinRemaining ?? 0) >= 20;

  useEffect(() => {
    if (!currentUserId || !catchupNeeded) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_nudge_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupNudgeShown(supabase, currentUserId, {
      date: dayKey,
      protein_remaining_g: Math.round(proteinRemaining ?? 0),
      protein_goal_g: proteinGoal,
      calories_so_far: Math.round(totalCalories),
    });
  }, [
    catchupNeeded,
    currentUserId,
    proteinRemaining,
    proteinGoal,
    selectedDate,
    supabase,
    totalCalories,
  ]);

  useEffect(() => {
    if (!currentUserId || !isToday || proteinGoal == null || proteinGoal <= 0) return;
    if (totalProtein < proteinGoal) return;

    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dedupeKey = `retention:nutrition_catchup_completed:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void trackNutritionCatchupCompleted(supabase, currentUserId, {
      date: dayKey,
      protein_goal_g: proteinGoal,
      protein_logged_g: Math.round(totalProtein),
      calories_logged: Math.round(totalCalories),
    });
  }, [currentUserId, isToday, proteinGoal, selectedDate, supabase, totalCalories, totalProtein]);

  const handleLoadTemplate = async (items: MealTemplateItem[]) => {
    if (!currentUserId) return;
    const now = new Date();
    try {
      for (const item of items) {
        const { error } = await supabase.from("food_log").insert({
          user_id: currentUserId,
          food_item_id: item.food_item_id,
          meal_type: "snack",
          servings: item.servings,
          calories_consumed: item.calories * item.servings,
          protein_g: item.protein_g != null ? item.protein_g * item.servings : null,
          carbs_g: item.carbs_g != null ? item.carbs_g * item.servings : null,
          fat_g: item.fat_g != null ? item.fat_g * item.servings : null,
          logged_at: now.toISOString(),
        });
        if (error) throw error;
      }
      // Re-fetch entries to show the newly added items
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const localDayStart = new Date(selectedDate);
      localDayStart.setHours(0, 0, 0, 0);
      const localNextDayStart = new Date(localDayStart);
      localNextDayStart.setDate(localNextDayStart.getDate() + 1);

      const { data: rawEntries } = await supabase
        .from("food_log")
        .select(
          "id, meal_type, servings, calories_consumed, protein_g, carbs_g, fat_g, logged_at, food_items(id, name, brand, barcode, source, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_description, serving_size_g)"
        )
        .eq("user_id", currentUserId)
        .gte("logged_at", localDayStart.toISOString())
        .lt("logged_at", localNextDayStart.toISOString())
        .order("logged_at", { ascending: true });

      setEntries((rawEntries ?? []) as unknown as FoodLogEntry[]);
    } catch (err) {
      console.error("Failed to load template items:", err);
      toast.error("Failed to add template items to log");
    }
  };

  const mealEntryToSnapshot = (entry: FoodLogEntry) => {
    const nutrition = getEntryNutrition(entry);
    return {
      name: entry.food_items?.name ?? entry.food_name ?? "Unknown",
      brand: entry.food_items?.brand ?? entry.food_brand ?? null,
      servings: entry.servings,
      calories: nutrition.calories,
      protein_g: nutrition.protein,
      carbs_g: nutrition.carbs,
      fat_g: nutrition.fat,
    };
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-4 md:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl glass-surface-elevated glass-highlight p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-36 w-36 rounded-full bg-[var(--phase-current-glow,oklch(0.98_0_0_/_0.15))] blur-3xl" />
        <div className="relative space-y-4">
          <PageHeader
            eyebrow={displayDate}
            title="Nutrition"
            actions={
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setMealSheetOpen(true)}
                  title="Saved Meals"
                >
                  <BookmarkPlus className="size-4" />
                  <span className="sr-only">Saved Meals</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setSendMealDialogOpen(true)}
                  disabled={entries.length === 0}
                  title="Share today's meals"
                >
                  <Share2 className="size-4" />
                  <span className="sr-only">Share Day</span>
                </Button>
                <Link href="/nutrition/scan">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Barcode className="size-4" />
                    <span className="hidden sm:inline">Scan</span>
                  </Button>
                </Link>
                <Link href="/nutrition/goals">
                  <Button size="icon" variant="ghost" className="size-9">
                    <Settings2 className="size-4" />
                    <span className="sr-only">Nutrition Goals</span>
                  </Button>
                </Link>
              </>
            }
          />

          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-2 py-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="text-sm font-medium"
              >
                {format(selectedDate, "MMM d, yyyy") === format(new Date(), "MMM d, yyyy")
                  ? "Today"
                  : format(selectedDate, "MMM d, yyyy")}
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
              disabled={format(selectedDate, "yyyy-MM-dd") >= format(new Date(), "yyyy-MM-dd")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border-border/70 bg-card/85">
              <CardContent className="pt-5 pb-4">
                {isToday ? (
                  <div className="mb-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Fuel Readiness
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {proteinGoal
                        ? `Projected by 9PM: ${projectedProteinBy9pm}g protein`
                        : "Set a protein goal to activate predictive fueling guidance."}
                    </p>
                  </div>
                ) : null}

                {calorieGoal != null ? (
                  <>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Calories consumed</p>
                        <p className="text-2xl font-bold text-foreground sm:text-4xl">
                          {Math.round(totalCalories)}
                          <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">
                            / {calorieGoal} kcal
                          </span>
                        </p>
                      </div>
                      <Badge variant={isOver ? "destructive" : "secondary"} className="w-fit rounded-full px-2.5 text-xs">
                        {isOver
                          ? `${Math.abs(Math.round(caloriesRemaining!))} over`
                          : `${Math.round(caloriesRemaining!)} left`}
                      </Badge>
                    </div>
                    <Progress
                      value={calorieProgress ?? 0}
                      className={`h-3 ${isOver ? "[&>div]:bg-destructive" : ""}`}
                    />
                  </>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Calories consumed</p>
                      <p className="text-2xl font-bold text-foreground sm:text-4xl">
                        {Math.round(totalCalories)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">kcal</span>
                      </p>
                    </div>
                    <Link href="/nutrition/goals">
                      <Button size="sm" variant="outline" className="w-fit gap-1.5 text-xs">
                        <Apple className="size-3.5" />
                        Set Goals
                      </Button>
                    </Link>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MacroChip label="Protein" value={totalProtein} goal={goals?.protein_g_target} colorClass={MACRO_COLORS.protein} />
                  <MacroChip label="Carbs" value={totalCarbs} goal={goals?.carbs_g_target} colorClass={MACRO_COLORS.carbs} />
                  <MacroChip label="Fat" value={totalFat} goal={goals?.fat_g_target} colorClass={MACRO_COLORS.fat} />
                  <MacroChip label="Fiber" value={totalFiber} goal={goals?.fiber_g_target} colorClass={MACRO_COLORS.fiber} />
                  <MacroChip label="Sugar" value={totalSugar} colorClass="text-rose-400" />
                  <MacroChip label="Sodium" value={totalSodiumMg} unit="mg" colorClass="text-cyan-400" />
                </div>

                {catchupNeeded ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Protein Catch-Up</p>
                      <p className="text-sm font-medium text-foreground">
                        Need {Math.round(proteinRemaining ?? 0)}g more to hit today&apos;s target.
                      </p>
                    </div>
                    <Link href="/nutrition/scan">
                      <Button size="sm" className="motion-press h-8 rounded-lg px-3 text-xs">
                        Add Protein
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Macro Rings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="calories" value={totalCalories} target={goals?.calories_target ?? 0} label="Calories" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="protein" value={totalProtein} target={goals?.protein_g_target ?? 0} label="Protein" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="carbs" value={totalCarbs} target={goals?.carbs_g_target ?? 0} label="Carbs" /></div>
                <div className="flex justify-center"><MacroRing size={96} strokeWidth={9} macro="fat" value={totalFat} target={goals?.fat_g_target ?? 0} label="Fat" /></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {(MENU_SCANNER_ENABLED || FOOD_SCANNER_ENABLED || GROCERY_GENERATOR_ENABLED) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MENU_SCANNER_ENABLED && (
            <Link href="/nutrition/menu-scan">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Camera className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Menu Scan</p>
                    <p className="text-xs text-muted-foreground">Scan a restaurant menu</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {FOOD_SCANNER_ENABLED && (
            <Link href="/nutrition/food-scan">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Utensils className="size-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Food Scan</p>
                    <p className="text-xs text-muted-foreground">Photograph your plate</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {GROCERY_GENERATOR_ENABLED && (
            <Link href="/nutrition/grocery">
              <Card className="border-border/70 bg-card/85 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                    <ShoppingCart className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Grocery List</p>
                    <p className="text-xs text-muted-foreground">Generate a smart grocery list</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Meals</h2>
          <p className="text-xs text-muted-foreground">Organized by meal windows</p>
        </div>

        {loading ? (
          <Card className="border-border/70 bg-card/85">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading nutrition data...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={mealGroups[meal]}
                getNutrition={getEntryNutrition}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>

      <MealTemplateSheet
        open={mealSheetOpen}
        onOpenChange={setMealSheetOpen}
        currentEntries={entries}
        onLoadTemplate={handleLoadTemplate}
      />

      <SendMealDialog
        open={sendMealDialogOpen}
        currentUserId={currentUserId}
        snapshot={
          entries.length > 0
            ? {
                date: format(selectedDate, "yyyy-MM-dd"),
                totals: {
                  calories: totalCalories,
                  protein_g: totalProtein,
                  carbs_g: totalCarbs,
                  fat_g: totalFat,
                  fiber_g: totalFiber,
                  sugar_g: totalSugar,
                  sodium_mg: totalSodiumMg,
                },
                meals: {
                  breakfast: mealGroups.breakfast.map(mealEntryToSnapshot),
                  lunch: mealGroups.lunch.map(mealEntryToSnapshot),
                  dinner: mealGroups.dinner.map(mealEntryToSnapshot),
                  snack: mealGroups.snack.map(mealEntryToSnapshot),
                },
              }
            : null
        }
        onClose={() => setSendMealDialogOpen(false)}
        onSend={sendMealDay}
      />
    </div>
  );
}
```

---
## src/app/(app)/nutrition/food-scan/page.tsx
```tsx
import { redirect } from "next/navigation";
import { FOOD_SCANNER_ENABLED } from "@/lib/features";
import { FoodScanner } from "@/components/nutrition/food-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FoodScanPage() {
  if (!FOOD_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Food Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Take a photo of your meal and we&apos;ll estimate the macros for each item. You can review and adjust before logging.
      </p>

      <FoodScanner />
    </div>
  );
}
```

---
## src/app/(app)/nutrition/menu-scan/page.tsx
```tsx
import { redirect } from "next/navigation";
import { MENU_SCANNER_ENABLED } from "@/lib/features";
import { MenuScanner } from "@/components/nutrition/menu-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MenuScanPage() {
  if (!MENU_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Menu Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Snap a photo of a restaurant menu and get personalized meal recommendations based on your remaining macros.
      </p>

      <MenuScanner />
    </div>
  );
}
```

---
## src/app/(app)/nutrition/grocery/page.tsx
```tsx
import { redirect } from "next/navigation";
import { GROCERY_GENERATOR_ENABLED } from "@/lib/features";
import { GroceryListBoard } from "@/components/nutrition/grocery-list-board";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GroceryPage() {
  if (!GROCERY_GENERATOR_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Grocery List</h1>
      </div>

      <GroceryListBoard />
    </div>
  );
}
```

---
## src/app/(app)/body/page.tsx
```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { format, parseISO, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { weightToDisplay, lbsToKg, lengthToDisplay, inchesToCm, lengthUnit } from "@/lib/units";
import {
  Scale,
  Ruler,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightLog = {
  id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
};

type MeasurementLog = {
  id: string;
  measured_date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  note: string | null;
};

type RangeOption = "30d" | "90d" | "1y" | "all";
type BodyTab = "weight" | "measurements";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kgToDisplay(kg: number, isImperial: boolean) {
  return weightToDisplay(kg, isImperial, 1);
}

function displayToKg(val: number, isImperial: boolean) {
  return isImperial ? lbsToKg(val) : val;
}

function displayToCm(val: number, isImperial: boolean) {
  return isImperial ? inchesToCm(val) : val;
}

const WeightChart = dynamic(() => import("@/components/charts/weight-chart"), {
  loading: () => <Skeleton className="h-[180px] w-full rounded-xl" />,
  ssr: false,
});

const MeasurementsChart = dynamic(
  () =>
    import("@/components/charts/measurements-chart").then((m) => ({
      default: m.MeasurementsChart,
    })),
  {
    loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
    ssr: false,
  }
);

// ─── Measurement fields config ────────────────────────────────────────────────

const MEASUREMENT_FIELDS: {
  key: keyof Pick<
    MeasurementLog,
    | "waist_cm"
    | "chest_cm"
    | "hips_cm"
    | "left_arm_cm"
    | "right_arm_cm"
    | "left_thigh_cm"
    | "right_thigh_cm"
  >;
  label: string;
  placeholder: string;
}[] = [
  { key: "waist_cm", label: "Waist", placeholder: "32.0" },
  { key: "chest_cm", label: "Chest", placeholder: "40.0" },
  { key: "hips_cm", label: "Hips", placeholder: "38.0" },
  { key: "left_arm_cm", label: "Left Arm", placeholder: "14.0" },
  { key: "right_arm_cm", label: "Right Arm", placeholder: "14.0" },
  { key: "left_thigh_cm", label: "Left Thigh", placeholder: "24.0" },
  { key: "right_thigh_cm", label: "Right Thigh", placeholder: "24.0" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BodyMetricsPage() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const measUnit = lengthUnit(isImperial);

  const [activeTab, setActiveTab] = useState<BodyTab>("weight");

  // ── Weight state ──
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>("90d");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Weight form state
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formWeight, setFormWeight] = useState("");
  const [formBf, setFormBf] = useState("");
  const [formNote, setFormNote] = useState("");

  // ── Measurements state ──
  const [measurements, setMeasurements] = useState<MeasurementLog[]>([]);
  const [measLoading, setMeasLoading] = useState(false);
  const [measShowForm, setMeasShowForm] = useState(false);
  const [measSubmitting, setMeasSubmitting] = useState(false);
  const [measEditingId, setMeasEditingId] = useState<string | null>(null);
  const [measFormError, setMeasFormError] = useState<string | null>(null);
  const [measFormDate, setMeasFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [measFormNote, setMeasFormNote] = useState("");
  const [measFormValues, setMeasFormValues] = useState<Record<string, string>>({});
  const measHasFetched = useRef(false);

  // ── Weight logic ──

  const resetForm = useCallback(() => {
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormWeight("");
    setFormBf("");
    setFormNote("");
    setFormError(null);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=365");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLogs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Filter by range
  const filteredLogs = (() => {
    if (range === "all") return [...logs];
    const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const cutoff = subDays(new Date(), days).toISOString().slice(0, 10);
    return logs.filter((l) => l.logged_date >= cutoff);
  })();

  // Chart data (chronological)
  const chartData = [...filteredLogs]
    .reverse()
    .map((l) => ({
      date: format(parseISO(l.logged_date), "MMM d"),
      weight_kg: l.weight_kg,
    }));

  const timelineLogs = [...filteredLogs].slice(0, 12).reverse();
  const timelineWeights = timelineLogs.map((l) => kgToDisplay(l.weight_kg, isImperial));
  const timelineMin = timelineWeights.length ? Math.min(...timelineWeights) : 0;
  const timelineMax = timelineWeights.length ? Math.max(...timelineWeights) : 0;
  const timelineSpread = timelineMax - timelineMin;
  const timelineStart = timelineLogs[0];
  const timelineCurrent = timelineLogs[timelineLogs.length - 1];
  const timelineChange =
    timelineStart && timelineCurrent
      ? kgToDisplay(timelineCurrent.weight_kg, isImperial) -
        kgToDisplay(timelineStart.weight_kg, isImperial)
      : null;

  // Stats
  const latest = logs[0];
  const oldest = filteredLogs[filteredLogs.length - 1];
  const delta =
    latest && oldest && latest.id !== oldest.id
      ? kgToDisplay(latest.weight_kg, isImperial) - kgToDisplay(oldest.weight_kg, isImperial)
      : null;

  const handleSave = async () => {
    setFormError(null);
    const wVal = parseFloat(formWeight);
    if (!formWeight || Number.isNaN(wVal) || wVal <= 0) {
      setFormError("Enter a valid weight greater than 0.");
      return;
    }

    const bodyFat = formBf.trim() ? parseFloat(formBf) : null;
    if (
      bodyFat != null &&
      (Number.isNaN(bodyFat) || bodyFat < 0 || bodyFat > 100)
    ) {
      setFormError("Body fat must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    const weight_kg = displayToKg(wVal, isImperial);
    const body_fat_pct = bodyFat;
    const payload = {
      logged_date: formDate,
      weight_kg,
      body_fat_pct,
      note: formNote.trim() || null,
    };

    const res = await fetch("/api/body/weight", {
      method: editingLogId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingLogId ? { id: editingLogId, ...payload } : payload),
    });

    if (res.ok) {
      resetForm();
      setEditingLogId(null);
      setShowForm(false);
      await fetchLogs();
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setFormError(err?.error ?? "Failed to save body metric entry.");
    }
    setSubmitting(false);
  };

  const handleEdit = (log: WeightLog) => {
    setEditingLogId(log.id);
    setFormDate(log.logged_date);
    setFormWeight(String(kgToDisplay(log.weight_kg, isImperial)));
    setFormBf(log.body_fat_pct != null ? String(log.body_fat_pct) : "");
    setFormNote(log.note ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/body/weight?id=${id}`, { method: "DELETE" });
    if (editingLogId === id) {
      handleCancelEdit();
      setShowForm(false);
    }
    await fetchLogs();
  };

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setEditingLogId(null);
      setFormError(null);
      return;
    }
    setEditingLogId(null);
    resetForm();
    setShowForm(true);
  };

  const TrendIcon =
    delta === null ? Minus : delta < 0 ? TrendingDown : TrendingUp;
  const trendColor =
    delta === null
      ? "text-muted-foreground"
      : delta < 0
      ? "text-emerald-400"
      : "text-rose-400";

  const RANGES: { label: string; value: RangeOption }[] = [
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "1Y", value: "1y" },
    { label: "All", value: "all" },
  ];

  // ── Measurements logic ──

  const resetMeasForm = useCallback(() => {
    setMeasFormDate(format(new Date(), "yyyy-MM-dd"));
    setMeasFormNote("");
    setMeasFormValues({});
    setMeasFormError(null);
  }, []);

  const fetchMeasurements = useCallback(async () => {
    setMeasLoading(true);
    try {
      const res = await fetch("/api/body/measurements?limit=365");
      if (res.ok) {
        const data = (await res.json()) as MeasurementLog[];
        setMeasurements(data);
      }
    } catch {
      toast.error("Failed to load measurements");
    } finally {
      setMeasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "measurements" && !measHasFetched.current) {
      measHasFetched.current = true;
      void fetchMeasurements();
    }
  }, [activeTab, fetchMeasurements]);

  const handleMeasSave = async () => {
    setMeasFormError(null);

    // Validate at least one field has a value
    const filledFields = MEASUREMENT_FIELDS.filter((f) => {
      const v = measFormValues[f.key]?.trim();
      return v && !Number.isNaN(parseFloat(v)) && parseFloat(v) > 0;
    });

    if (filledFields.length === 0) {
      setMeasFormError("Enter at least one measurement.");
      return;
    }

    setMeasSubmitting(true);

    const payload: Record<string, unknown> = {
      measured_date: measFormDate,
      note: measFormNote.trim() || null,
    };

    for (const f of MEASUREMENT_FIELDS) {
      const raw = measFormValues[f.key]?.trim();
      if (raw && !Number.isNaN(parseFloat(raw)) && parseFloat(raw) > 0) {
        payload[f.key] = displayToCm(parseFloat(raw), isImperial);
      } else {
        payload[f.key] = null;
      }
    }

    try {
      const res = await fetch("/api/body/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          measEditingId ? { id: measEditingId, ...payload } : payload
        ),
      });

      if (res.ok) {
        resetMeasForm();
        setMeasEditingId(null);
        setMeasShowForm(false);
        await fetchMeasurements();
        toast.success(measEditingId ? "Measurement updated" : "Measurement saved");
      } else {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMeasFormError(err?.error ?? "Failed to save measurement.");
      }
    } catch {
      setMeasFormError("Failed to save measurement.");
    }
    setMeasSubmitting(false);
  };

  const handleMeasEdit = (log: MeasurementLog) => {
    setMeasEditingId(log.id);
    setMeasFormDate(log.measured_date);
    setMeasFormNote(log.note ?? "");
    const vals: Record<string, string> = {};
    for (const f of MEASUREMENT_FIELDS) {
      const v = log[f.key];
      if (v != null) {
        vals[f.key] = String(lengthToDisplay(v, isImperial, 1));
      }
    }
    setMeasFormValues(vals);
    setMeasFormError(null);
    setMeasShowForm(true);
  };

  const handleMeasDelete = async (id: string) => {
    try {
      await fetch(`/api/body/measurements?id=${id}`, { method: "DELETE" });
      if (measEditingId === id) {
        setMeasEditingId(null);
        resetMeasForm();
        setMeasShowForm(false);
      }
      await fetchMeasurements();
      toast.success("Measurement deleted");
    } catch {
      toast.error("Failed to delete measurement");
    }
  };

  const toggleMeasForm = () => {
    if (measShowForm) {
      setMeasShowForm(false);
      setMeasEditingId(null);
      setMeasFormError(null);
      return;
    }
    setMeasEditingId(null);
    resetMeasForm();
    setMeasShowForm(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-6">
      <PageHeader title="Body Metrics" />

      {/* ── Tab Switcher ──────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {(
          [
            { value: "weight", label: "Weight", Icon: Scale },
            { value: "measurements", label: "Measurements", Icon: Ruler },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold transition-colors",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            <tab.Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  WEIGHT TAB                                                 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "weight" && (
        <>
          {/* ── Hero Stats ─────────────────────────────────────────────── */}
          <div className="rounded-3xl glass-surface-elevated glass-highlight p-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : latest ? (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Current Weight
                  </p>
                  <p className="text-[40px] font-black leading-none tabular-nums">
                    {kgToDisplay(latest.weight_kg, isImperial)}
                    <span className="ml-1.5 text-[18px] font-bold text-muted-foreground">
                      {unitLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(parseISO(latest.logged_date), "MMMM d, yyyy")}
                  </p>
                </div>
                {delta !== null && (
                  <div className={cn("flex items-center gap-1 text-sm font-semibold", trendColor)}>
                    <TrendIcon className="h-4 w-4" />
                    <span>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)} {unitLabel}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No weight logged yet. Add your first entry below.
              </div>
            )}
          </div>

          {/* ── Chart ──────────────────────────────────────────────────── */}
          {!loading && logs.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold text-foreground">Weight History</p>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRange(r.value)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                        range === r.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.length > 0 ? (
                <>
                  <WeightChart chartData={chartData} isImperial={isImperial} />
                  {chartData.length === 1 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Add one more entry to unlock a full trend line.
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[12px] text-muted-foreground">
                    No entries in this range.
                  </p>
                  <Button
                    onClick={() => setRange("all")}
                    variant="outline"
                    size="xs"
                    className="mt-2"
                  >
                    Show All
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Timeline Ribbon ────────────────────────────────────────── */}
          {!loading && timelineLogs.length > 1 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Body Trend Ribbon</p>
                  <p className="text-[10px] text-muted-foreground">
                    Last {timelineLogs.length} entries in this view
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Range {timelineMin.toFixed(1)}-{timelineMax.toFixed(1)} {unitLabel}
                </p>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
                  <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                    {timelineStart ? `${kgToDisplay(timelineStart.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</p>
                  <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                    {timelineCurrent ? `${kgToDisplay(timelineCurrent.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Change</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12px] font-semibold tabular-nums",
                      timelineChange == null
                        ? "text-muted-foreground"
                        : timelineChange < 0
                          ? "text-emerald-400"
                          : timelineChange > 0
                            ? "text-rose-400"
                            : "text-muted-foreground"
                    )}
                  >
                    {timelineChange == null
                      ? "--"
                      : `${timelineChange > 0 ? "+" : ""}${timelineChange.toFixed(1)} ${unitLabel}`}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {timelineLogs.map((log, idx) => {
                  const displayWeight = kgToDisplay(log.weight_kg, isImperial);
                  const prevWeight =
                    idx > 0
                      ? kgToDisplay(timelineLogs[idx - 1].weight_kg, isImperial)
                      : null;
                  const stepDelta =
                    prevWeight != null ? displayWeight - prevWeight : null;
                  const rawPct =
                    timelineSpread <= 0
                      ? 100
                      : ((displayWeight - timelineMin) / timelineSpread) * 100;
                  const pct = Math.max(8, Math.min(100, rawPct));
                  const barColor =
                    stepDelta == null
                      ? "bg-primary"
                      : stepDelta < 0
                        ? "bg-emerald-400"
                        : stepDelta > 0
                          ? "bg-rose-400"
                          : "bg-primary";

                  return (
                    <div
                      key={log.id}
                      className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(log.logged_date), "MMM d")}
                      </p>
                      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/40">
                        <motion.div
                          className={cn("h-full rounded-full", barColor)}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.35 }}
                        />
                        <div className="absolute inset-y-0 right-0 w-px bg-border/60" />
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold tabular-nums text-foreground">
                          {displayWeight.toFixed(1)}
                        </p>
                        {stepDelta != null && (
                          <p
                            className={cn(
                              "text-[9px] tabular-nums",
                              stepDelta < 0
                                ? "text-emerald-400"
                                : stepDelta > 0
                                  ? "text-rose-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {stepDelta > 0 ? "+" : ""}
                            {stepDelta.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Log Form ───────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
            <button
              onClick={toggleForm}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  {editingLogId ? (
                    <Pencil className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="text-[13px] font-bold">
                  {editingLogId ? "Edit Entry" : "Log Weight"}
                </span>
              </div>
              <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {showForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
                    {editingLogId && (
                      <p className="text-[11px] font-medium text-primary">
                        Editing an existing body metric entry
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Date</Label>
                        <Input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Weight ({unitLabel})</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          placeholder={unitLabel === "kg" ? "75.0" : "165.0"}
                          value={formWeight}
                          onChange={(e) => setFormWeight(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Body Fat % (optional)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="18.5"
                          value={formBf}
                          onChange={(e) => setFormBf(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Note (optional)</Label>
                        <Input
                          placeholder="Morning, after workout..."
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    {formError && (
                      <p className="text-[11px] text-destructive">{formError}</p>
                    )}
                    <div className="flex gap-2">
                      {editingLogId && (
                        <Button
                          onClick={handleCancelEdit}
                          disabled={submitting}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleSave}
                        disabled={submitting || !formWeight}
                        className="flex-1"
                        size="sm"
                      >
                        {submitting
                          ? editingLogId
                            ? "Updating..."
                            : "Saving..."
                          : editingLogId
                          ? "Update Entry"
                          : "Save Entry"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Log List ───────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-[13px] font-bold">
                <Scale className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Recent Entries
              </p>
            </div>

            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No entries yet. Log your first weight above.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {logs.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5",
                      editingLogId === log.id && "bg-primary/5"
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {kgToDisplay(log.weight_kg, isImperial)} {unitLabel}
                        {log.body_fat_pct != null && (
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            {log.body_fat_pct}% BF
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(log.logged_date), "EEE, MMM d yyyy")}
                        {log.note ? ` · ${log.note}` : ""}
                      </p>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <Button
                        onClick={() => handleEdit(log)}
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Edit entry"
                        className="text-muted-foreground/70 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(log.id)}
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete entry"
                        className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  MEASUREMENTS TAB                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "measurements" && (
        <>
          {/* ── Measurements Chart ─────────────────────────────────── */}
          {!measLoading && measurements.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <p className="mb-3 text-[13px] font-bold text-foreground">
                Measurement Trends
              </p>
              <MeasurementsChart
                measurements={measurements}
                isImperial={isImperial}
              />
            </div>
          )}

          {/* ── Measurement Log Form ───────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
            <button
              onClick={toggleMeasForm}
              className="flex w-full items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  {measEditingId ? (
                    <Pencil className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="text-[13px] font-bold">
                  {measEditingId ? "Edit Measurement" : "Log Measurements"}
                </span>
              </div>
              <motion.div
                animate={{ rotate: measShowForm ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {measShowForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
                    {measEditingId && (
                      <p className="text-[11px] font-medium text-primary">
                        Editing an existing measurement entry
                      </p>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[11px]">Date</Label>
                      <Input
                        type="date"
                        value={measFormDate}
                        onChange={(e) => setMeasFormDate(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Measurements ({measUnit})
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {MEASUREMENT_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-[11px]">{f.label}</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            placeholder={f.placeholder}
                            value={measFormValues[f.key] ?? ""}
                            onChange={(e) =>
                              setMeasFormValues((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Note (optional)</Label>
                      <Input
                        placeholder="Morning, relaxed..."
                        value={measFormNote}
                        onChange={(e) => setMeasFormNote(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    {measFormError && (
                      <p className="text-[11px] text-destructive">{measFormError}</p>
                    )}

                    <div className="flex gap-2">
                      {measEditingId && (
                        <Button
                          onClick={() => {
                            setMeasEditingId(null);
                            resetMeasForm();
                          }}
                          disabled={measSubmitting}
                          className="flex-1"
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleMeasSave}
                        disabled={measSubmitting}
                        className="flex-1"
                        size="sm"
                      >
                        {measSubmitting
                          ? measEditingId
                            ? "Updating..."
                            : "Saving..."
                          : measEditingId
                          ? "Update Entry"
                          : "Save Entry"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Measurements List ──────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-[13px] font-bold">
                <Ruler className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Recent Measurements
              </p>
            </div>

            {measLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : measurements.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Ruler className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No measurements logged yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Track waist, chest, arms and more to see your body change over time.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={toggleMeasForm}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Start logging metrics
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {measurements.slice(0, 30).map((m) => {
                  const parts = MEASUREMENT_FIELDS.filter(
                    (f) => m[f.key] != null
                  ).map(
                    (f) =>
                      `${f.label}: ${lengthToDisplay(m[f.key]!, isImperial, 1)}${measUnit}`
                  );

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5",
                        measEditingId === m.id && "bg-primary/5"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {format(parseISO(m.measured_date), "EEE, MMM d yyyy")}
                          {m.note ? ` · ${m.note}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-foreground">
                          {parts.join(" | ")}
                        </p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        <Button
                          onClick={() => handleMeasEdit(m)}
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit measurement"
                          className="text-muted-foreground/70 hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleMeasDelete(m.id)}
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Delete measurement"
                          className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---
## src/app/(app)/history/page.tsx
```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePrimaryColor } from "@/hooks/use-primary-color";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryNav } from "@/components/history/history-nav";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SessionSet = {
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type SessionItem = {
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  workout_templates: {
    name: string;
  } | null;
  workout_sets: SessionSet[];
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HistoryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const primaryColor = usePrimaryColor();
  const { preference, unitLabel } = useUnitPreferenceStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [dateUpdating, setDateUpdating] = useState(false);
  const [dateInputValue, setDateInputValue] = useState("");
  const [targetSession, setTargetSession] = useState<SessionItem | null>(null);

  function toDatetimeLocalValue(iso: string) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toDisplayWeight(kg: number) {
    return weightToDisplay(kg, preference === "imperial", 1);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          "id,name,started_at,completed_at,duration_seconds,workout_templates(name),workout_sets(set_number,reps,weight_kg,exercises(name,muscle_group))"
        )
        .eq("status", "completed")
        .order("started_at", { ascending: false });

      if (!active) return;

      if (error) {
        setSessions([]);
      } else {
        setSessions((data as unknown as SessionItem[]) ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, SessionItem[]>();

    for (const session of sessions) {
      const key = dayKey(new Date(session.started_at));
      const existing = grouped.get(key) ?? [];
      existing.push(session);
      grouped.set(key, existing);
    }

    return grouped;
  }, [sessions]);

  const selectedKey = dayKey(selectedDay);
  const sessionsForSelectedDay = sessionsByDay.get(selectedKey) ?? [];

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart); // Sunday
    const calEnd = endOfWeek(monthEnd);       // Saturday

    const days: Date[] = [];
    let current = calStart;
    while (current <= calEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [viewMonth]);

  async function handleDeleteSession(sessionId: string) {
    const confirmed = window.confirm("Delete this workout from history?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast.error(error.message || "Failed to delete workout");
      return;
    }

    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    toast.success("Workout deleted");
  }

  function handleOpenDateDialog(session: SessionItem) {
    setTargetSession(session);
    setDateInputValue(toDatetimeLocalValue(session.started_at));
    setDateDialogOpen(true);
  }

  async function handleSaveDateChange() {
    if (!targetSession || !dateInputValue) return;

    const nextStart = new Date(dateInputValue);
    if (Number.isNaN(nextStart.getTime())) {
      toast.error("Please choose a valid date and time");
      return;
    }

    const oldStart = new Date(targetSession.started_at);
    const oldCompleted = targetSession.completed_at
      ? new Date(targetSession.completed_at)
      : null;
    const durationMs = oldCompleted
      ? Math.max(0, oldCompleted.getTime() - oldStart.getTime())
      : null;

    const updatePayload: {
      started_at: string;
      completed_at?: string | null;
      duration_seconds?: number | null;
    } = {
      started_at: nextStart.toISOString(),
    };

    if (durationMs != null) {
      const nextCompleted = new Date(nextStart.getTime() + durationMs);
      updatePayload.completed_at = nextCompleted.toISOString();
      updatePayload.duration_seconds = Math.round(durationMs / 1000);
    }

    setDateUpdating(true);
    const { error } = await supabase
      .from("workout_sessions")
      .update(updatePayload)
      .eq("id", targetSession.id);

    setDateUpdating(false);

    if (error) {
      toast.error(error.message || "Failed to update workout date");
      return;
    }

    setSessions((prev) =>
      prev.map((session) =>
        session.id === targetSession.id
          ? {
            ...session,
            started_at: updatePayload.started_at,
            completed_at:
              updatePayload.completed_at === undefined
                ? session.completed_at
                : updatePayload.completed_at,
            duration_seconds:
              updatePayload.duration_seconds === undefined
                ? session.duration_seconds
                : updatePayload.duration_seconds,
          }
          : session
      )
    );

    setDateDialogOpen(false);
    setTargetSession(null);
    setDateInputValue("");
    toast.success("Workout date updated");
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-6 pb-28 md:px-6 lg:px-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="History"
          subtitle="Calendar + daily logs with templates, muscle groups, reps, and sets."
        />
        <HistoryNav />
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ── Custom Calendar ────────────────────────────────────────── */}
        <div className="h-fit rounded-2xl border border-border/60 bg-card/30 p-4">
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <h3 className="text-[13px] font-bold text-foreground">
              {format(viewMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-border/40"
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = dayKey(day);
              const inMonth = isSameMonth(day, viewMonth);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              const workoutCount = (sessionsByDay.get(key) ?? []).length;
              const hasWorkout = workoutCount > 0;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(day);
                    if (!isSameMonth(day, viewMonth)) {
                      setViewMonth(startOfMonth(day));
                    }
                  }}
                  className="relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-200 hover:bg-border/30"
                  style={
                    selected
                      ? {
                          backgroundColor: primaryColor,
                          color: "white",
                          boxShadow: `0 0 12px 2px ${primaryColor}44`,
                        }
                      : hasWorkout && !selected
                      ? {
                          backgroundColor: `${primaryColor}18`,
                          boxShadow: `inset 0 0 0 1.5px ${primaryColor}55`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`text-[13px] tabular-nums font-semibold leading-none ${
                      selected
                        ? "text-white"
                        : !inMonth
                        ? "text-muted-foreground/30"
                        : hasWorkout
                        ? "font-bold"
                        : "text-foreground/80"
                    }`}
                    style={
                      hasWorkout && !selected ? { color: primaryColor } : undefined
                    }
                  >
                    {format(day, "d")}
                  </span>

                  {/* Workout indicator dot */}
                  {hasWorkout && (
                    <div
                      className="mt-0.5 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: selected ? "white" : primaryColor,
                        boxShadow: selected
                          ? "0 0 4px rgba(255,255,255,0.6)"
                          : `0 0 4px ${primaryColor}66`,
                      }}
                    />
                  )}

                  {/* Today ring (when not selected) */}
                  {today && !selected && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{
                        boxShadow: `inset 0 0 0 1.5px ${primaryColor}40`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected Day Details ───────────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card/30 p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-foreground">{format(selectedDay, "EEEE, MMMM d")}</h3>
          </div>
          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading history...</p> : null}

            {!loading && sessionsForSelectedDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed workouts on this day.</p>
            ) : null}

            {sessionsForSelectedDay.map((session) => {
              const muscleGroups = [...new Set(
                session.workout_sets
                  .map((set) => set.exercises?.muscle_group)
                  .filter((value): value is string => Boolean(value))
              )];

              const totalSets = session.workout_sets.length;
              const totalReps = session.workout_sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);

              const byExercise = new Map<string, SessionSet[]>();
              for (const set of session.workout_sets) {
                const key = set.exercises?.name ?? "Unknown Exercise";
                const current = byExercise.get(key) ?? [];
                current.push(set);
                byExercise.set(key, current);
              }

              return (
                <div key={session.id} className="rounded-2xl border border-border/60 bg-card/30 p-5">
                  <div className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-base font-semibold text-foreground">{session.name}</h4>
                        <p className="truncate text-xs text-muted-foreground">
                          Template: {session.workout_templates?.name ?? "No template"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {totalSets} sets
                          </span>
                          <span className="rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {totalReps} reps
                          </span>
                          <span className="max-w-[200px] truncate rounded-xl border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {muscleGroups.length > 0 ? muscleGroups.join(", ") : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => router.push(`/history/${session.id}/edit`)}
                        >
                          <Pencil className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => handleOpenDateDialog(session)}
                        >
                          <CalendarClock className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Change Date</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 rounded-xl"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="hidden sm:inline ml-1.5">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[...byExercise.entries()].map(([exerciseName, sets]) => (
                      <div key={exerciseName} className="rounded-xl border border-border/50 bg-card/40 p-3 text-sm">
                        <p className="min-w-0 truncate font-medium text-foreground">{exerciseName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sets.map((set, i) => (
                            <span
                              key={i}
                              className="inline-flex rounded-md bg-muted/40 px-2 py-0.5 text-[11px] tabular-nums font-semibold"
                            >
                              {set.weight_kg != null ? `${toDisplayWeight(set.weight_kg)} ${unitLabel}` : "BW"} x {set.reps ?? 0}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Workout Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workout-date-time">Date and time</Label>
            <Input
              id="workout-date-time"
              type="datetime-local"
              value={dateInputValue}
              onChange={(e) => setDateInputValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDateDialogOpen(false)}
              disabled={dateUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDateChange} disabled={dateUpdating}>
              {dateUpdating ? "Saving..." : "Save Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---
## src/app/(app)/history/progress/page.tsx
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, kgToLbs } from "@/lib/units";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  BarChart3,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryNav } from "@/components/history/history-nav";
// pdf-export loaded dynamically in handleExportPDF to reduce bundle
const ProgressCharts = {
  SparklineChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.SparklineChart),
    { ssr: false }
  ),
  StrengthLineChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.StrengthLineChart),
    {
      loading: () => <Skeleton className="h-[260px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
  StackedVolumeBarChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.StackedVolumeBarChart),
    {
      loading: () => <Skeleton className="h-[260px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
  CategoryMiniBarChart: dynamic(
    () => import("@/components/charts/progress-charts").then((m) => m.CategoryMiniBarChart),
    {
      loading: () => <Skeleton className="h-[140px] w-full rounded-2xl" />,
      ssr: false,
    }
  ),
};

// ─── Types ──────────────────────────────────────────────────────────────────

type RawSet = {
  session_id: string;
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  set_type: string;
  workout_sessions: {
    started_at: string;
    status: string;
  };
  exercises: {
    name: string;
    muscle_group: string;
  } | null;
};

type RawSession = {
  id: string;
  name: string;
  started_at: string;
  total_volume_kg: number | null;
};

// ─── Volume category mapping ──────────────────────────────────────────────────

const VOLUME_CATEGORIES: Record<string, string> = {
  chest: "Upper Body",
  back: "Upper Body",
  shoulders: "Upper Body",
  arms: "Upper Body",
  legs: "Legs",
  core: "Core",
  full_body: "Full Body",
};

const VOLUME_CATEGORY_COLORS: Record<string, string> = {
  "Upper Body": "var(--color-primary)",
  Legs: "#f87171",
  Core: "#facc15",
  "Full Body": "#34d399",
};

const VOLUME_CATEGORY_ORDER = ["Upper Body", "Legs", "Core", "Full Body"] as const;

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (t: string) => void;
}) {
  const tabs = [
    { id: "strength", label: "Strength", icon: TrendingUp },
    { id: "volume", label: "Volume", icon: BarChart3 },
  ];
  return (
    <div className="flex gap-0.5 rounded-2xl border border-border/60 bg-card/40 p-1.5">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-semibold transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function PillToggle({
  opts,
  active,
  onChange,
}: {
  opts: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex max-w-full gap-0.5 overflow-x-auto scrollbar-none rounded-full p-1">
      {opts.map((o) => {
        const on = active === o;
        return (
          <motion.button
            key={o}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(o)}
            className={cn(
              "shrink-0 whitespace-nowrap h-8 rounded-full px-3.5 text-[11px] font-semibold transition-all duration-200",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Sparkline card ───────────────────────────────────────────────────────────

function SparklineCard({
  name,
  muscleGroup,
  dataPoints,
  trend,
  onClick,
}: {
  name: string;
  muscleGroup: string;
  dataPoints: { date: string; value: number }[];
  trend: number;
  onClick: () => void;
}) {
  const trendLabel =
    trend > 0 ? `+${Math.round(trend)}%` : trend < 0 ? `${Math.round(trend)}%` : "No change";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-border/60 bg-card/30 p-4 text-left transition-all hover:border-primary/30 hover:bg-card/80"
    >
      <p className="text-[13px] font-semibold min-w-0 truncate text-foreground">{name}</p>
      <p className="text-[10px] capitalize text-muted-foreground">
        {muscleGroup?.replace("_", " ")}
      </p>

      <div className="mt-1.5 h-[60px] w-full">
        <ProgressCharts.SparklineChart name={name} dataPoints={dataPoints} />
      </div>

      <div className="mt-1 flex justify-end">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums",
            trend > 0
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
              : trend < 0
                ? "border-red-400/20 bg-red-400/10 text-red-400"
                : "border-border/60 bg-muted/30 text-muted-foreground"
          )}
        >
          {trendLabel}
        </span>
      </div>
    </motion.button>
  );
}

// ─── Empty / Loading states ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[260px] w-full rounded-2xl" />
    </div>
  );
}

function SparklineSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[130px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const supabase = useMemo(() => createClient(), []);
  const { preference: unitPreference, unitLabel } = useUnitPreferenceStore();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<RawSet[]>([]);
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [strengthMetric, setStrengthMetric] = useState<"score" | "weight">("score");

  const [tab, setTab] = useState("strength");
  const [strengthView, setStrengthView] = useState<"all" | "single">("all");
  const [volumeView, setVolumeView] = useState("Stacked");
  const [isExporting, setIsExporting] = useState(false);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [setsRes, sessionsRes] = await Promise.all([
        supabase
          .from("workout_sets")
          .select(
            `
            session_id, exercise_id, reps, weight_kg, set_type,
            workout_sessions!inner(started_at, status),
            exercises(name, muscle_group)
          `
          )
          .eq("workout_sessions.status", "completed")
          .eq("workout_sessions.user_id", user.id),
        supabase
          .from("workout_sessions")
          .select("id, name, started_at, total_volume_kg")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("started_at", { ascending: true }),
      ]);

      if (!active) return;

      if (setsRes.error) {
        console.error("[Progress] sets query error:", setsRes.error);
      }
      if (sessionsRes.error) {
        console.error("[Progress] sessions query error:", sessionsRes.error);
      }

      const rows = (setsRes.data ?? []) as unknown as RawSet[];
      const sessionRows = (sessionsRes.data ?? []) as RawSession[];
      setSets(rows);
      setSessions(sessionRows);

      const exercisesById = new Map<string, string>();
      for (const row of rows) {
        if (row.exercises?.name)
          exercisesById.set(row.exercise_id, row.exercises.name);
      }
      const options = [...exercisesById.entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      );
      if (options.length > 0) setSelectedExerciseId(options[0][0]);

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const exerciseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of sets) {
      if (s.exercises?.name) byId.set(s.exercise_id, s.exercises.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  function convertWeight(kg: number) {
    return weightToDisplay(kg, unitPreference === "imperial", 1);
  }

  // ── Sparklines for "All Exercises" ────────────────────────────────────────

  const allExerciseSparklines = useMemo(() => {
    const byExercise = new Map<
      string,
      {
        name: string;
        muscleGroup: string;
        sessions: Map<string, { rawDate: string; topScore: number; topWeight: number }>;
      }
    >();

    for (const s of sets) {
      if (!s.exercises?.name || s.weight_kg == null) continue;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;

      let exercise = byExercise.get(s.exercise_id);
      if (!exercise) {
        exercise = {
          name: s.exercises.name,
          muscleGroup: s.exercises.muscle_group,
          sessions: new Map(),
        };
        byExercise.set(s.exercise_id, exercise);
      }

      const existing = exercise.sessions.get(s.session_id);
      if (!existing || score > existing.topScore) {
        exercise.sessions.set(s.session_id, {
          rawDate: s.workout_sessions.started_at,
          topScore: score,
          topWeight: weight,
        });
      }
    }

    return [...byExercise.entries()]
      .map(([id, data]) => {
        const points = [...data.sessions.values()]
          .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
          .map((dp) => ({
            date: format(new Date(dp.rawDate), "MMM d"),
            value: strengthMetric === "score" ? Math.round(dp.topScore) : dp.topWeight,
          }));

        const first = points[0]?.value ?? 0;
        const last = points[points.length - 1]?.value ?? 0;
        const trend = first > 0 ? ((last - first) / first) * 100 : 0;

        return {
          exerciseId: id,
          name: data.name,
          muscleGroup: data.muscleGroup,
          dataPoints: points,
          trend,
        };
      })
      .filter((ex) => ex.dataPoints.length >= 2)
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, unitPreference, strengthMetric]);

  // ── Single exercise strength data ─────────────────────────────────────────

  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const bySession = new Map<
      string,
      {
        rawDate: string;
        topSetScore: number | null;
        topSetWeight: number;
        topSetReps: number;
        topWeight: number;
        topWeightReps: number;
      }
    >();

    for (const s of sets) {
      if (s.exercise_id !== selectedExerciseId || s.weight_kg == null) continue;
      const rawDate = s.workout_sessions.started_at;
      const weight = convertWeight(s.weight_kg);
      const reps = s.reps ?? 0;
      const score = weight * reps;
      const hasValid = s.reps != null && s.reps > 0;

      const ex = bySession.get(s.session_id);
      if (!ex) {
        bySession.set(s.session_id, {
          rawDate,
          topSetScore: hasValid ? score : null,
          topSetWeight: weight,
          topSetReps: reps,
          topWeight: weight,
          topWeightReps: reps,
        });
        continue;
      }
      if (hasValid && (ex.topSetScore == null || score > ex.topSetScore)) {
        ex.topSetScore = score;
        ex.topSetWeight = weight;
        ex.topSetReps = reps;
      }
      if (weight > ex.topWeight) {
        ex.topWeight = weight;
        ex.topWeightReps = reps;
      }
    }

    return [...bySession.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .filter((v) => (strengthMetric === "weight" ? true : v.topSetScore != null))
      .map((v) => ({
        date: format(new Date(v.rawDate), "MMM d"),
        topSetScore: v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0,
        topSetWeight: v.topSetWeight,
        topSetReps: v.topSetReps,
        topWeight: v.topWeight,
        topWeightReps: v.topWeightReps,
        displayValue:
          strengthMetric === "score"
            ? v.topSetScore != null ? Math.round(v.topSetScore * 10) / 10 : 0
            : v.topWeight,
        rawDate: v.rawDate,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, selectedExerciseId, strengthMetric, unitPreference]);

  // Best stats for single exercise view
  const bestStats = useMemo(() => {
    if (strengthData.length === 0) return null;
    let bestWeight = { value: 0, reps: 0, date: "" };
    let bestScore = { value: 0, weight: 0, reps: 0, date: "" };
    for (const d of strengthData) {
      if (d.topWeight > bestWeight.value) {
        bestWeight = { value: d.topWeight, reps: d.topWeightReps, date: d.date };
      }
      if (d.topSetScore > bestScore.value) {
        bestScore = { value: d.topSetScore, weight: d.topSetWeight, reps: d.topSetReps, date: d.date };
      }
    }
    return { bestWeight, bestScore };
  }, [strengthData]);

  // ── Volume by category ────────────────────────────────────────────────────

  const categoryVolumeData = useMemo(() => {
    const sessionMap = new Map<
      string,
      { rawDate: string; categories: Record<string, number> }
    >();

    for (const s of sets) {
      if (s.weight_kg == null || !s.exercises?.muscle_group) continue;
      const weight = unitPreference === "imperial" ? kgToLbs(s.weight_kg) : s.weight_kg;
      const volume = weight * (s.reps ?? 0);
      const category = VOLUME_CATEGORIES[s.exercises.muscle_group] ?? "Full Body";

      let session = sessionMap.get(s.session_id);
      if (!session) {
        session = {
          rawDate: s.workout_sessions.started_at,
          categories: { "Upper Body": 0, Legs: 0, Core: 0, "Full Body": 0 },
        };
        sessionMap.set(s.session_id, session);
      }
      session.categories[category] += volume;
    }

    return [...sessionMap.values()]
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-30)
      .map((s) => ({
        date: format(new Date(s.rawDate), "MMM d"),
        "Upper Body": Math.round(s.categories["Upper Body"]),
        Legs: Math.round(s.categories["Legs"]),
        Core: Math.round(s.categories["Core"]),
        "Full Body": Math.round(s.categories["Full Body"]),
        total: Math.round(
          s.categories["Upper Body"] + s.categories["Legs"] + s.categories["Core"] + s.categories["Full Body"]
        ),
      }));
  }, [sets, unitPreference]);

  // Volume summary stats
  const volumeStats = useMemo(() => {
    if (categoryVolumeData.length === 0) return null;
    const last = categoryVolumeData[categoryVolumeData.length - 1];
    const avg = categoryVolumeData.reduce((s, d) => s + d.total, 0) / categoryVolumeData.length;
    const prevAvg =
      categoryVolumeData.length > 1
        ? categoryVolumeData.slice(0, -1).reduce((s, d) => s + d.total, 0) / (categoryVolumeData.length - 1)
        : avg;
    const delta = prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : 0;
    return {
      latest: last?.total ?? 0,
      avg: Math.round(avg),
      delta: Math.round(delta * 10) / 10,
    };
  }, [categoryVolumeData]);

  const totalSessions = sessions.length;

  // ── PDF Export ────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { generateProgressPDF } = await import("@/lib/pdf-export");
      await generateProgressPDF({
        userName: "Athlete",
        reportDate: new Date(),
        totalSessions,
        totalPRs: 0,
        avgVolume: volumeStats?.avg,
        strengthCharts: allExerciseSparklines.map((c) => ({ ...c, unitLabel })),
        personalRecords: [],
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md pb-28">
        {/* Header */}
        <div className="px-5 pb-5 pt-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  Analytics
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>
              </div>
              <HistoryNav />
            </div>
            {sessions.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleExportPDF}
                disabled={isExporting}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isExporting ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                {isExporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                )}
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </motion.button>
            )}
          </div>

          {!loading && totalSessions > 0 && (
            <p className="mb-4 text-[13px] text-muted-foreground">
              {totalSessions} session{totalSessions !== 1 ? "s" : ""}
            </p>
          )}

          <TabBar active={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            {/* ── STRENGTH TAB ─────────────────────────────────────────── */}
            {tab === "strength" && (
              <motion.div
                key="strength"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <SparklineSkeleton />
                ) : exerciseOptions.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {strengthView === "all" ? (
                      <motion.div
                        key="all"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="All Exercises"
                            onChange={(v) => v === "Single Exercise" && setStrengthView("single")}
                          />
                        </div>
                        <div className="mb-4">
                          <PillToggle
                            opts={["Top Set Score", "Top Weight"]}
                            active={strengthMetric === "score" ? "Top Set Score" : "Top Weight"}
                            onChange={(v) => setStrengthMetric(v === "Top Set Score" ? "score" : "weight")}
                          />
                        </div>

                        {allExerciseSparklines.length === 0 ? (
                          <EmptyState message="Need at least 2 sessions per exercise to show trends" />
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {allExerciseSparklines.map((ex) => (
                              <SparklineCard
                                key={ex.exerciseId}
                                name={ex.name}
                                muscleGroup={ex.muscleGroup}
                                dataPoints={ex.dataPoints}
                                trend={ex.trend}
                                onClick={() => {
                                  setSelectedExerciseId(ex.exerciseId);
                                  setStrengthView("single");
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="single"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => setStrengthView("all")}
                          className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-primary transition hover:text-primary/80"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to overview
                        </button>

                        {/* Exercise dropdown */}
                        <div className="relative mb-4">
                          <select
                            value={selectedExerciseId}
                            onChange={(e) => setSelectedExerciseId(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-border/60 bg-card px-4 py-2.5 pr-10 text-sm font-semibold text-foreground transition focus:border-primary/40 focus:outline-none"
                          >
                            {exerciseOptions.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>

                        <div className="mb-3 flex items-center justify-between">
                          <PillToggle
                            opts={["All Exercises", "Single Exercise"]}
                            active="Single Exercise"
                            onChange={(v) => v === "All Exercises" && setStrengthView("all")}
                          />
                        </div>

                        {strengthData.length === 0 ? (
                          <EmptyState message="No data for this exercise" />
                        ) : (
                          <>
                            <div className="mb-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-[13px] font-bold text-foreground">
                                  {exerciseOptions.find((e) => e.id === selectedExerciseId)?.name ?? "Exercise"}
                                </p>
                                <span className="rounded-full border border-border/50 bg-card/40 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                                  {strengthMetric === "score" ? "Top Set Score" : `Max Weight (${unitLabel})`}
                                </span>
                              </div>
                              <div className="h-[240px] sm:h-[300px]">
                                <ProgressCharts.StrengthLineChart strengthData={strengthData} unitLabel={unitLabel} />
                              </div>
                            </div>

                            {/* Best stats pills */}
                            {bestStats && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Best Weight</p>
                                  <p className="tabular-nums text-[22px] font-black leading-none text-primary">
                                    {bestStats.bestWeight.value} {unitLabel}
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {bestStats.bestWeight.date} · {bestStats.bestWeight.reps} reps
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Best Score</p>
                                  <p className="tabular-nums text-[22px] font-black leading-none text-primary">
                                    {Math.round(bestStats.bestScore.value).toLocaleString()} pts
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {bestStats.bestScore.date} · {bestStats.bestScore.reps} reps
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

            {/* ── VOLUME TAB ───────────────────────────────────────────── */}
            {tab === "volume" && (
              <motion.div
                key="volume"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                {loading ? (
                  <ChartSkeleton />
                ) : categoryVolumeData.length === 0 ? (
                  <EmptyState message="No data yet — start logging workouts" />
                ) : (
                  <AnimatePresence mode="wait">
                    {volumeView === "Stacked" ? (
                      <motion.div
                        key="stacked"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        {/* Legend */}
                        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => (
                            <div key={cat} className="flex items-center gap-1.5">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ background: VOLUME_CATEGORY_COLORS[cat] }}
                              />
                              <span className="text-[11px] text-muted-foreground">{cat}</span>
                            </div>
                          ))}
                        </div>

                        {/* Stacked chart */}
                        <div className="mb-4 rounded-2xl border border-border/60 bg-card/30 p-5">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Session Volume ({unitLabel})
                          </p>
                          <ProgressCharts.StackedVolumeBarChart
                            categoryVolumeData={categoryVolumeData}
                            unitLabel={unitLabel}
                            volumeCategoryOrder={VOLUME_CATEGORY_ORDER}
                            volumeCategoryColors={VOLUME_CATEGORY_COLORS}
                          />
                        </div>

                        {/* Volume summary */}
                        {volumeStats && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Latest Session</p>
                              <p className="tabular-nums text-[22px] font-black leading-none text-foreground">
                                {(volumeStats.latest / 1000).toFixed(1)}k
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{unitLabel}</p>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Avg / Session</p>
                              <p className="tabular-nums text-[22px] font-black leading-none text-foreground">
                                {(volumeStats.avg / 1000).toFixed(1)}k
                              </p>
                              <div className="mt-0.5 flex items-center gap-1">
                                <p className="text-[10px] text-muted-foreground">{unitLabel}</p>
                                {volumeStats.delta !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold tabular-nums",
                                      volumeStats.delta > 0 ? "text-emerald-400" : "text-red-400"
                                    )}
                                  >
                                    {volumeStats.delta > 0 ? "+" : ""}
                                    {volumeStats.delta}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="bycategory"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mb-4">
                          <PillToggle
                            opts={["Stacked", "By Category"]}
                            active={volumeView}
                            onChange={setVolumeView}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {VOLUME_CATEGORY_ORDER.map((cat) => {
                            const color = VOLUME_CATEGORY_COLORS[cat];
                            const hasData = categoryVolumeData.some(
                              (d) => (d[cat as keyof typeof d] as number) > 0
                            );
                            return (
                              <div key={cat} className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 p-4">
                                <p className="mb-2.5 text-xs font-semibold" style={{ color }}>
                                  {cat}
                                </p>
                                {!hasData ? (
                                  <p className="py-8 text-center text-[10px] text-muted-foreground">No data</p>
                                ) : (
                                  <ProgressCharts.CategoryMiniBarChart
                                    categoryVolumeData={categoryVolumeData}
                                    category={cat}
                                    color={color}
                                    unitLabel={unitLabel}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>


    </div>
  );
}
```

---
## src/app/(app)/history/prs/prs-client.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Medal, Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUP_LABELS } from "@/lib/constants";

type PR = {
  id: string;
  name: string;
  muscle_group: string;
  pr_kg: number;
  reps: number | null;
  achieved_at: string;
  e1rm_kg: number | null;
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  biceps: "bg-amber-500/20 text-amber-400",
  triceps: "bg-orange-500/20 text-orange-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  glutes: "bg-pink-500/20 text-pink-400",
  abs: "bg-cyan-500/20 text-cyan-400",
  cardio: "bg-indigo-500/20 text-indigo-400",
};

const MUSCLE_DOT_COLORS: Record<string, string> = {
  chest: "bg-rose-400",
  back: "bg-sky-400",
  shoulders: "bg-violet-400",
  biceps: "bg-amber-400",
  triceps: "bg-orange-400",
  legs: "bg-emerald-400",
  glutes: "bg-pink-400",
  abs: "bg-cyan-400",
  cardio: "bg-indigo-400",
};

function getMuscleColor(group: string) {
  return MUSCLE_COLORS[group.toLowerCase()] ?? "bg-muted/50 text-muted-foreground";
}

export function PRsClient({
  prs,
  muscleGroups,
}: {
  prs: PR[];
  muscleGroups: string[];
}) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const displayWeight = (kg: number) =>
    isImperial
      ? `${Math.round(kgToLbs(kg))} lbs`
      : `${Math.round(kg * 10) / 10} kg`;

  const filtered = useMemo(() => {
    return prs.filter((pr) => {
      const matchGroup = activeGroup === "all" || pr.muscle_group === activeGroup;
      const matchQuery =
        !query || pr.name.toLowerCase().includes(query.toLowerCase());
      return matchGroup && matchQuery;
    });
  }, [prs, activeGroup, query]);

  // Group filtered PRs by muscle group
  const grouped = useMemo(() => {
    const map = new Map<string, PR[]>();
    for (const pr of filtered) {
      if (!map.has(pr.muscle_group)) map.set(pr.muscle_group, []);
      map.get(pr.muscle_group)!.push(pr);
    }
    return map;
  }, [filtered]);

  const topPRs = useMemo(() => {
    return [...prs]
      .sort((a, b) => {
        const aW = isImperial ? kgToLbs(a.pr_kg) : a.pr_kg;
        const bW = isImperial ? kgToLbs(b.pr_kg) : b.pr_kg;
        return bW - aW;
      })
      .slice(0, 3);
  }, [prs, isImperial]);

  return (
    <div className="space-y-5">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topPRs.map((pr, idx) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-2xl border border-border/60 bg-card/30 p-4 text-center"
          >
            <div className="mb-1.5 flex justify-center">
              <Medal className={cn("h-7 w-7", idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-400" : "text-amber-600")} />
            </div>
            <p className="truncate min-w-0 text-[12px] sm:text-[13px] font-semibold">{pr.name}</p>
            <p className="tabular-nums text-[22px] sm:text-[26px] font-black leading-none text-foreground">
              {displayWeight(pr.pr_kg)}
            </p>
            {pr.reps && (
              <p className="mt-1 text-[11px] text-muted-foreground">x {pr.reps} reps</p>
            )}
            {pr.e1rm_kg != null && pr.e1rm_kg > pr.pr_kg && (
              <p className="mt-0.5 text-[10px] text-primary/70 font-medium">
                e1RM {displayWeight(pr.e1rm_kg)}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Search + Muscle Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercise…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGroup("all")}
            className={cn(
              "h-8 rounded-full px-3.5 text-[11px] font-semibold transition-colors",
              activeGroup === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setActiveGroup(mg === activeGroup ? "all" : mg)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[11px] font-semibold capitalize transition-colors",
                activeGroup === mg
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {(MUSCLE_GROUP_LABELS as Record<string, string>)[mg] ?? mg}
            </button>
          ))}
        </div>
      </div>

      {/* PR Groups */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">No results</p>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([group, groupPRs]) => (
            <div key={group} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full shrink-0", MUSCLE_DOT_COLORS[group.toLowerCase()] ?? "bg-muted-foreground")} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                  {(MUSCLE_GROUP_LABELS as Record<string, string>)[group] ?? group}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {groupPRs.length} exercise{groupPRs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {groupPRs.map((pr, idx) => (
                  <motion.div
                    key={pr.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between gap-3 min-w-0 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold min-w-0 truncate">{pr.name}</p>
                        {pr.achieved_at && (
                          <p className="text-[11px] text-muted-foreground shrink-0">
                            {format(parseISO(pr.achieved_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="tabular-nums text-[15px] font-black shrink-0">
                        {displayWeight(pr.pr_kg)}
                      </p>
                      {pr.reps && (
                        <p className="text-[11px] text-muted-foreground">x {pr.reps} reps</p>
                      )}
                      {pr.e1rm_kg != null && pr.e1rm_kg > pr.pr_kg && (
                        <p className="text-[10px] text-primary/70 font-medium">
                          e1RM {displayWeight(pr.e1rm_kg)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---
## src/app/(app)/history/stats/page.tsx
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
import { HistoryNav } from "@/components/history/history-nav";
import type { HistoryStatsResponse } from "@/app/api/history/stats/route";
import {
  BarChart3,
  Dumbbell,
  CalendarDays,
  Clock,
  Flame,
  Weight,
} from "lucide-react";

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number, isImperial: boolean) {
  if (isImperial) {
    const lbs = kgToLbs(kg);
    if (lbs >= 2000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${Math.round(lbs).toLocaleString()} lbs`;
  }
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export default function HistoryStatsPage() {
  const router = useRouter();
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [stats, setStats] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch("/api/history/stats");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;

      const data: HistoryStatsResponse = await res.json();
      if (active) {
        setStats(data);
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [router]);

  const maxCount = stats?.top_muscle_groups[0]?.set_count ?? 1;

  const months = useMemo(() => {
    if (!stats) return [];
    // Fill in missing months from last 6 months
    const monthMap: Record<string, { sessions: number; volume_kg: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { sessions: 0, volume_kg: 0 };
    }
    for (const m of stats.monthly_breakdown) {
      if (monthMap[m.month_key]) {
        monthMap[m.month_key] = { sessions: m.sessions, volume_kg: m.volume_kg };
      }
    }
    return Object.entries(monthMap);
  }, [stats]);

  const STAT_CARDS = stats
    ? [
        { icon: Dumbbell, label: "Total Sessions", value: stats.total_sessions.toLocaleString(), color: "text-primary" },
        { icon: Weight, label: "Total Volume", value: formatVolume(stats.total_volume_kg, isImperial), color: "text-amber-400" },
        { icon: Clock, label: "Avg Session", value: stats.avg_duration_seconds > 0 ? formatDuration(stats.avg_duration_seconds) : "—", color: "text-sky-400" },
        { icon: Flame, label: "Longest Streak", value: `${stats.longest_streak}d`, color: "text-rose-400" },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Workout Stats</h1>
        </div>
        <HistoryNav />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        </div>
      ) : stats && stats.total_sessions > 0 ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAT_CARDS.map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/60 bg-card/30 p-5 text-center"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-card/70">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <p className="tabular-nums text-[28px] font-black leading-none text-foreground">{value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Muscle Group Bar Chart */}
          {stats.top_muscle_groups.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/30">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <Dumbbell className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-bold">Top Muscle Groups</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="p-5 space-y-3">
                {stats.top_muscle_groups.map(({ muscle_group, set_count }) => (
                  <div key={muscle_group} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium capitalize">{muscle_group}</span>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{set_count} sets</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(set_count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Breakdown */}
          <div className="rounded-2xl border border-border/60 bg-card/30">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-bold">Monthly Breakdown</span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="p-5 space-y-2.5">
              {months.map(([key, data]) => {
                const [year, month] = key.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", {
                  month: "short",
                  year: "2-digit",
                });
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3">
                    <span className="text-[12px] font-semibold">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-[13px] font-bold text-foreground">
                        {data.sessions} sessions
                      </span>
                      <span className="tabular-nums text-[13px] font-bold text-muted-foreground">
                        {formatVolume(data.volume_kg, isImperial)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No workouts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Complete your first workout to see stats here.</p>
        </div>
      )}
    </div>
  );
}
```

---
## src/app/(app)/marketplace/page.tsx
```tsx
import { MarketplaceContent } from "@/components/marketplace/marketplace-content";

export const metadata = {
  title: "Marketplace — Fit-Hub",
  description: "Browse and import community-built workout templates.",
};

export default function MarketplacePage() {
  return <MarketplaceContent />;
}
```

---
## src/app/(app)/pods/page.tsx
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Plus, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePods } from "@/hooks/use-pods";

export default function PodsPage() {
  const router = useRouter();
  const { pods, loading, error } = usePods();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-5 pb-28">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pods</h1>
          <p className="text-sm text-muted-foreground">Accountability groups for consistency</p>
        </div>
        <Button onClick={() => router.push("/pods/create")} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      {/* Empty State */}
      {pods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">No pods yet</p>
              <p className="text-sm text-muted-foreground">
                Create or join a pod to stay accountable
              </p>
            </div>
            <Button onClick={() => router.push("/pods/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Pod
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Pod List */
        <div className="space-y-3">
          {pods.map((pod) => (
            <Card
              key={pod.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => router.push(`/pods/${pod.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 truncate text-base">{pod.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pod.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pod.description}
                  </p>
                )}

                {/* Member avatars */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {pod.members.slice(0, 5).map((member, idx) => (
                      <div
                        key={member.user_id}
                        className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold"
                        style={{ zIndex: 5 - idx }}
                      >
                        {(member.display_name || member.username || "?")[0].toUpperCase()}
                      </div>
                    ))}
                    {pod.member_count > 5 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        +{pod.member_count - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pod.members.map(m => m.display_name || m.username).slice(0, 2).join(", ")}
                    {pod.member_count > 2 && ` +${pod.member_count - 2} more`}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Stay consistent together</p>
              <p className="text-muted-foreground">
                Set weekly workout goals, track progress, and encourage your pod members
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---
## src/app/(app)/settings/page.tsx
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronRight, Scale, Dumbbell, LayoutList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ExportDataCard } from "./export-data-card";
import { NotificationPreferencesCard } from "./notification-preferences-card";
import { SignOutButton } from "./sign-out-button";

const QUICK_ACCESS_LINKS = [
  {
    href: "/body",
    title: "Body Metrics",
    description: "Track weight and body composition over time",
    Icon: Scale,
    cta: "Open Body Metrics",
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Review Smart Launcher performance and trends",
    Icon: BarChart3,
    cta: "Open Analytics",
  },
  {
    href: "/workout/templates",
    title: "My Templates",
    description: "Manage and publish your workout templates",
    Icon: LayoutList,
    cta: "Open Templates",
  },
  {
    href: "/exercises",
    title: "Exercise Library",
    description: "Browse all available exercises",
    Icon: Dumbbell,
    cta: "Browse Library",
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-28 pt-6">
      <PageHeader title="Settings" />

      <Card className="border-border/60 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account & Preferences</CardTitle>
          <CardDescription className="text-xs">
            Update your profile, privacy, units, and theme in one place.
          </CardDescription>
        </CardHeader>
      </Card>

      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        userId={user.id}
      />

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutList className="h-4 w-4 text-primary" />
            Quick Access
          </CardTitle>
          <CardDescription className="text-xs">
            Jump to commonly used areas without leaving settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUICK_ACCESS_LINKS.map(({ href, title, description, Icon, cta }) => (
            <Button
              key={href}
              variant="outline"
              className="h-auto w-full justify-between px-3 py-3"
              asChild
            >
              <Link href={href}>
                <span className="flex items-start gap-3 text-left">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {cta}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <ExportDataCard />

      <NotificationPreferencesCard />

      <div className="border-t border-border/50 pt-2">
        <div className="flex justify-center">
          <SignOutButton
            label="Sign out of FitHub"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          />
        </div>
      </div>
    </div>
  );
}
```

---
## src/app/(app)/exercises/exercises-client.tsx
```tsx
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExerciseRow } from "./page";

const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  arms: "bg-amber-500/20 text-amber-400",
  core: "bg-cyan-500/20 text-cyan-400",
  full_body: "bg-primary/20 text-primary",
};

const EQUIPMENT_BADGE_COLORS: Record<string, string> = {
  barbell: "bg-slate-500/20 text-slate-400",
  dumbbell: "bg-orange-500/20 text-orange-400",
  kettlebell: "bg-yellow-500/20 text-yellow-400",
  cable: "bg-teal-500/20 text-teal-400",
  machine: "bg-indigo-500/20 text-indigo-400",
  bodyweight: "bg-lime-500/20 text-lime-400",
  band: "bg-fuchsia-500/20 text-fuchsia-400",
};

function ExerciseCard({ ex, muscleGroupLabels, equipmentLabels }: {
  ex: ExerciseRow;
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-border/50 bg-card/40 overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ex.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                MUSCLE_BADGE_COLORS[ex.muscle_group] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {muscleGroupLabels[ex.muscle_group] ?? ex.muscle_group}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                EQUIPMENT_BADGE_COLORS[ex.equipment] ?? "bg-muted/50 text-muted-foreground"
              )}
            >
              {equipmentLabels[ex.equipment] ?? ex.equipment}
            </span>
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
              {ex.category}
            </span>
          </div>
        </div>
        <span className="ml-2 shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && ex.instructions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-3 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{ex.instructions}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ExercisesClient({
  exercises,
  muscleGroups,
  equipmentTypes,
  muscleGroupLabels,
  equipmentLabels,
}: {
  exercises: ExerciseRow[];
  muscleGroups: string[];
  equipmentTypes: string[];
  muscleGroupLabels: Record<string, string>;
  equipmentLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [activeMuscle, setActiveMuscle] = useState("all");
  const [activeEquipment, setActiveEquipment] = useState("all");

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchMuscle = activeMuscle === "all" || ex.muscle_group === activeMuscle;
      const matchEquip = activeEquipment === "all" || ex.equipment === activeEquipment;
      const matchQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
      return matchMuscle && matchEquip && matchQuery;
    });
  }, [exercises, activeMuscle, activeEquipment, query]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Muscle filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveMuscle("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeMuscle === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {muscleGroups.map((mg) => (
          <button
            key={mg}
            onClick={() => setActiveMuscle(mg === activeMuscle ? "all" : mg)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeMuscle === mg
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {muscleGroupLabels[mg] ?? mg}
          </button>
        ))}
      </div>

      {/* Equipment filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveEquipment("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            activeEquipment === "all"
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Any equipment
        </button>
        {equipmentTypes.map((eq) => (
          <button
            key={eq}
            onClick={() => setActiveEquipment(eq === activeEquipment ? "all" : eq)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              activeEquipment === eq
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {equipmentLabels[eq] ?? eq}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-muted-foreground">
        Showing {filtered.length} of {exercises.length} exercises
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No exercises match your filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              muscleGroupLabels={muscleGroupLabels}
              equipmentLabels={equipmentLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

