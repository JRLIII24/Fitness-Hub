"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Clock3, NotebookPen, Plus, Save, Dumbbell, Zap, Loader2, ArrowUpDown, GripVertical, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  trackSessionIntentSet,
} from "@/lib/retention-events";
import { EXERCISE_LIBRARY } from "@/lib/exercise-library";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import type { ActiveWorkout, Exercise, WorkoutSet } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "@/lib/constants";
import { getMuscleColor, MUSCLE_FILTERS } from "@/lib/muscle-colors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExerciseSwapSheet } from "@/components/workout/exercise-swap-sheet";
import { useExerciseTrendlines } from "@/hooks/use-exercise-trendlines";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay, kgToLbs } from "@/lib/units";
import { POPULAR_WORKOUTS, type WorkoutPresetId } from "@/lib/workout-presets";
import { WorkoutPlanCard } from "@/components/workout/workout-plan-card";
import { PlanSwapSheet } from "@/components/workout/plan-swap-sheet";
import { estimateWorkoutDuration } from "@/lib/workout-duration";
import type { PlanExercise, WorkoutPlan } from "@/types/workout";
import {
  isMissingTableError,
  slugify,
  normalizeEquipment,
  makeCustomExercise,
} from "@/lib/workout/exercise-resolver";
import { RestTimerPill } from "@/components/workout/rest-timer-pill";
import { SaveTemplateDialog } from "@/components/workout/save-template-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { ExerciseLibrarySheet } from "@/components/workout/exercise-library-sheet";
import { WorkoutCompleteCelebration } from "@/components/workout/workout-complete-celebration";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";

// Extracted hooks
import { useGhostSession } from "@/hooks/workout/use-ghost-session";
import { useExerciseSwap } from "@/hooks/workout/use-exercise-swap";
import { useWorkoutCompletion } from "@/hooks/workout/use-workout-completion";
import { useTemplateActions, type WorkoutTemplate } from "@/hooks/workout/use-template-actions";
import { usePredictiveSets } from "@/hooks/use-predictive-sets";

// Extracted components
import { WorkoutHeader, ElapsedTime } from "@/components/workout/workout-header";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { WorkoutCompletionDialog } from "@/components/workout/workout-completion-dialog";
import { TemplateManagerPanel } from "@/components/workout/template-manager-panel";
import { QuickStartPanel } from "@/components/workout/quick-start-panel";
import { AI_COACH_ENABLED } from "@/lib/features";
import { VoiceCommandBar } from "@/components/coach/voice-command-bar";
import { ActiveProgramCard } from "@/components/workout/active-program-card";
import { RestoreWorkoutBanner, type WorkoutDraft } from "@/components/workout/restore-workout-banner";
import { TrainSubNav } from "@/components/layout/train-sub-nav";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const TEMPLATE_LIKES_KEY = "workout_template_likes_v1";

// Thin sortable wrapper — keeps ExerciseCard pure and memoised
function SortableExerciseCard({
  exerciseId,
  ...props
}: { exerciseId: string } & React.ComponentProps<typeof ExerciseCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: exerciseId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ExerciseCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// Compact reorder item — shown in reorder mode
function SortableReorderItem({
  exerciseId,
  name,
  completedSets,
  totalSets,
}: {
  exerciseId: string;
  name: string;
  completedSets: number;
  totalSets: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: exerciseId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-11 items-center gap-2 rounded-lg px-2 transition-colors",
        isDragging ? "bg-primary/10 shadow-md" : "hover:bg-card/60"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {completedSets}/{totalSets}
      </span>
    </div>
  );
}

export default function WorkoutPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [dbFeaturesAvailable, setDbFeaturesAvailable] = useState(true);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  const [programRefreshKey, setProgramRefreshKey] = useState(0);

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

  const [exerciseLibraryOpen, setExerciseLibraryOpen] = useState(false);

  const [previousByExerciseId, setPreviousByExerciseId] = useState<
    Record<string, Array<{ reps: number | null; weight: number | null }>>
  >({});
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Plan preview state
  const [setupPhase, setSetupPhase] = useState<"selection" | "plan-preview">("selection");
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planSwapIndex, setPlanSwapIndex] = useState<number | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

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
    reorderExercise,
    swapExercise,
    addSet,
    updateSet,
    removeSet,
    completeSet,
    setExerciseNote,
    setWorkoutNote,
    updateWorkoutName,
    applyPredictiveOverload,
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
      reorderExercise: s.reorderExercise,
      swapExercise: s.swapExercise,
      addSet: s.addSet,
      updateSet: s.updateSet,
      removeSet: s.removeSet,
      completeSet: s.completeSet,
      setExerciseNote: s.setExerciseNote,
      setWorkoutNote: s.setWorkoutNote,
      updateWorkoutName: s.updateWorkoutName,
      applyPredictiveOverload: s.applyPredictiveOverload,
    }))
  );

  const startTimer = useTimerStore((state) => state.startTimer);
  const getActiveTimers = useTimerStore((state) => state.getActiveTimers);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const { sendTemplateToMany } = useSharedItems(userId);
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

  // Stable exercise ID list — only changes when exercises are added/removed
  const _exerciseIdList = activeWorkout?.exercises.map((e) => e.exercise.id) ?? [];
  const activeExerciseIds = useMemo(
    () => _exerciseIdList,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(_exerciseIdList)]
  );

  const selectedExerciseIds = useMemo(
    () =>
      new Set(activeExerciseIds),
    [activeExerciseIds]
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

  // Build exerciseId -> muscleGroup map for smart overload suggestions
  const exerciseMuscleGroups = useMemo(() => {
    const map: Record<string, string> = {};
    if (activeWorkout) {
      for (const ex of activeWorkout.exercises) {
        map[ex.exercise.id] = ex.exercise.muscle_group;
      }
    }
    return map;
  }, [activeWorkout]);

  // Ghost session: loads ghost data for selected template
  const {
    ghostWorkoutData,
    ghostIsLoading,
    suggestedWeightsByKey,
    smartSuggestions,
    patchGhostForExercise,
  } = useGhostSession(supabase, userId, selectedTemplateId, preference, exerciseMuscleGroups);

  // Exercise swap: manages swap sheet state + targeted ghost refetch
  const {
    swapSheetIndex,
    setSwapSheetIndex,
    handleSwapExercise,
  } = useExerciseSwap(swapExercise, patchGhostForExercise);

  // Predictive overload: fetch last-session performance and auto-fill sets
  const predictiveMap = usePredictiveSets(
    activeWorkout?.exercises ?? [],
    userId
  );
  const predictiveAppliedRef = useRef(false);

  useEffect(() => {
    if (predictiveAppliedRef.current) return;
    if (predictiveMap.size === 0) return;
    if (!activeWorkout || activeWorkout.exercises.length === 0) return;

    predictiveAppliedRef.current = true;
    applyPredictiveOverload(predictiveMap);
  }, [predictiveMap, activeWorkout, applyPredictiveOverload]);

  // Reset the ref guard when workout changes (new workout started)
  useEffect(() => {
    if (!isWorkoutActive) {
      predictiveAppliedRef.current = false;
    }
  }, [isWorkoutActive]);

  // Workout completion: finish, cancel, celebration, RPE
  const {
    celebrationStats,
    celebrationWorkoutName,
    showCelebration,
    levelUpData,
    recapData,
    recapLoading,
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
    onProgramAdvanced: () => setProgramRefreshKey((k) => k + 1),
  });

  // Sparkline trendlines -- only fetches when workout is active
  const exerciseTrendlines = useExerciseTrendlines(activeExerciseIds, userId, isWorkoutActive);

  const loadTemplates = useCallback(async (currentUserId: string) => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from("workout_templates")
      .select("id,name,primary_muscle_group")
      .eq("user_id", currentUserId)
      .is("program_id", null)
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

      // Check for an abandoned workout draft (only when no active workout in store)
      if (!useWorkoutStore.getState().isWorkoutActive) {
        try {
          const res = await fetch("/api/workout/draft");
          const json = await res.json() as { draft: WorkoutDraft | null };
          if (active && json.draft) setWorkoutDraft(json.draft);
        } catch {
          // ignore — draft fetch is best-effort
        }
      }
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

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (template) {
      setWorkoutName(template.name);
    }
  }, [selectedTemplateId, templates]);

  // Derive a stable key from exercise IDs so we only refetch when exercises change,
  // NOT on every set update (weight/reps/completed changes).
  const exerciseIdKey = useMemo(
    () => activeExerciseIds.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(activeExerciseIds)]
  );


  useEffect(() => {
    async function loadPreviousPerformance() {
      if (!userId || !exerciseIdKey) {
        setPreviousByExerciseId({});
        return;
      }

      // Filter out temporary custom-* IDs (not valid UUIDs)
      const exerciseIds = exerciseIdKey.split(",").filter((id) => id && !id.startsWith("custom-"));
      if (exerciseIds.length === 0) {
        setPreviousByExerciseId({});
        return;
      }



      // First, find the most recent completed session per exercise (max 1 per exercise)
      // This avoids scanning the entire workout_sets history
      const { data: recentSessions, error: sessErr } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10);

      if (sessErr || !recentSessions || recentSessions.length === 0) {
        setPreviousByExerciseId({});

        return;
      }

      const sessionIds = recentSessions.map(s => s.id);

      const { data: completedSets, error } = await supabase
        .from("workout_sets")
        .select(
          "exercise_id,set_number,reps,weight_kg,completed_at,session_id,workout_sessions!inner(id,user_id,status,completed_at)"
        )
        .eq("workout_sessions.user_id", userId)
        .eq("workout_sessions.status", "completed")
        .not("completed_at", "is", null)
        .in("exercise_id", exerciseIds)
        .in("session_id", sessionIds);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdKey, supabase, userId]);

  // Auto-start workout when coming from launcher, adaptive, or active program card
  useEffect(() => {
    if (hasAutoStarted || isWorkoutActive || loadingTemplates) return;

    const fromLauncher = searchParams.get('from_launcher');
    const fromAdaptive = searchParams.get('from_adaptive');
    const fromProgram = searchParams.get('from_program');
    if (!fromLauncher && !fromAdaptive && !fromProgram) return;

    const templateId = searchParams.get('template_id');
    async function autoStart() {
      setHasAutoStarted(true);

      // from_program: template is a program-generated template (filtered from templates[]),
      // so skip templates.find() and load exercises directly from DB.
      if (fromProgram && templateId && userId) {
        const workoutName = searchParams.get('name') ?? 'Program Workout';
        setSelectedTemplateId(templateId);
        setWorkoutName(workoutName);
        startWorkout(workoutName, userId, templateId);

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

          await applyAutofillFromHistory();
          toast.success(`Started ${workoutName}`);
        } catch (err) {
          console.error('Program template load error:', err);
          toast.error('Failed to load program workout');
        }
        return;
      }

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

          if (!exerciseData?.name) continue;

          addExercise(exerciseData as Exercise);

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
  }, [searchParams, templates, loadingTemplates, isWorkoutActive, hasAutoStarted, startWorkout, addExercise, updateSet, addSet, supabase, userId]);

  async function handleRestoreDraft(draft: WorkoutDraft) {
    setWorkoutDraft(null);
    if (!draft.data || !userId) return;

    const { workoutName: name, startedAt, templateId, exercises } = draft.data;
    startWorkout(name, userId, templateId ?? undefined);

    for (const ex of exercises) {
      addExercise(ex.exercise);
      const exIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
      if (!exIndex) continue;
      const idx = exIndex - 1;

      for (let si = 0; si < ex.sets.length; si++) {
        if (si > 0) addSet(idx);
        updateSet(idx, si, {
          reps: ex.sets[si].reps,
          weight_kg: ex.sets[si].weight_kg,
          rest_seconds: ex.sets[si].rest_seconds,
          rir: ex.sets[si].rir,
          set_type: ex.sets[si].set_type,
        });
        if (ex.sets[si].completed) {
          completeSet(idx, si);
        }
      }
    }

    // Restore the original start time
    useWorkoutStore.setState((s) =>
      s.activeWorkout ? { activeWorkout: { ...s.activeWorkout, started_at: startedAt } } : {}
    );

    toast.success(`Restored "${name}"`);
  }

  async function handleDiscardDraft() {
    setWorkoutDraft(null);
    await fetch("/api/workout/draft", { method: "DELETE" }).catch(() => {});
  }

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
      .eq("muscle_group", exercise.muscle_group as any)
      .limit(1)
      .maybeSingle();

    if (byName) return byName as unknown as Exercise;

    if (!userId) throw new Error("No user found.");

    const { data: inserted, error: insertError } = await supabase
      .from("exercises")
      .insert({
        name: exercise.name,
        slug: candidateSlug,
        muscle_group: exercise.muscle_group as any,
        equipment: normalizeEquipment(exercise.equipment) as any,
        category: exercise.category as any,
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
        .insert(toInsert as any)
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

    // Weight and reps are NOT auto-filled here — the smart suggestion chip
    // in SetRow shows the progressive overload suggestion as a tappable ghost.
    // The user decides whether to accept it, preventing override of coach prescriptions.
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

      if (setupTab === "quick" && presetId !== "custom") {
        const preset = POPULAR_WORKOUTS.find((item) => item.id === presetId);
        const liftNames = preset?.lifts.map((l) => l.name) ?? [];

        // Fetch exercises by name directly from DB — allExercises may be empty
        // when the user hasn't browsed the exercise picker yet
        const { data: presetExercises } = await supabase
          .from("exercises")
          .select(EXERCISE_SELECT_COLS)
          .in("name", liftNames);

        const exerciseByName = new Map<string, Exercise>();
        for (const row of presetExercises ?? []) {
          const ex = row as unknown as Exercise;
          if (!exerciseByName.has(ex.name)) exerciseByName.set(ex.name, ex);
        }

        // For exercises not yet in DB, use EXERCISE_LIBRARY stubs —
        // ensureExerciseRecordsBatch will create them
        const libraryByName = new Map<string, Exercise>();
        for (const ex of EXERCISE_LIBRARY) {
          if (!libraryByName.has(ex.name)) libraryByName.set(ex.name, ex);
        }

        const liftsWithExercises = (preset?.lifts ?? [])
          .map((lift) => ({
            lift,
            exercise: exerciseByName.get(lift.name) ?? libraryByName.get(lift.name),
          }))
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

  async function handlePreviewPlan() {
    const name = workoutName.trim() || "Workout";
    const activeTemplateId = selectedTemplateId === "none" ? undefined : selectedTemplateId;

    // Validate category for templates tab
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
        // "Start Fresh" — skip plan preview, go directly to handleStartWorkout
        if (pendingCategories.length === 0) {
          toast.error("Please select a workout type before starting.");
          return;
        }
        handleStartWorkout();
        return;
      }
    }

    // Custom preset — skip plan preview
    if (setupTab === "quick" && presetId === "custom") {
      handleStartWorkout();
      return;
    }

    setPlanLoading(true);
    try {
      const planExercises: PlanExercise[] = [];

      if (activeTemplateId) {
        // Template flow
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
            handleStartWorkout();
            return;
          }
          throw error;
        }

        for (const row of templateExercises ?? []) {
          const exercise = row.exercises as unknown as Exercise | null;
          if (!exercise) continue;

          const parsedReps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;
          planExercises.push({
            exercise,
            targetSets: Math.max(1, row.target_sets ?? 1),
            targetReps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            targetWeightKg: row.target_weight_kg ?? null,
            restSeconds: row.rest_seconds ?? 90,
            muscleGroup: exercise.muscle_group,
          });
        }
      } else if (setupTab === "quick" && presetId !== "custom") {
        // Preset flow
        const preset = POPULAR_WORKOUTS.find((item) => item.id === presetId);
        if (!preset) {
          handleStartWorkout();
          return;
        }

        const liftNames = preset.lifts.map((l) => l.name);
        const { data: presetExercises } = await supabase
          .from("exercises")
          .select(EXERCISE_SELECT_COLS)
          .in("name", liftNames);

        const exerciseByName = new Map<string, Exercise>();
        for (const row of presetExercises ?? []) {
          const ex = row as unknown as Exercise;
          if (!exerciseByName.has(ex.name)) exerciseByName.set(ex.name, ex);
        }

        const libraryByName = new Map<string, Exercise>();
        for (const ex of EXERCISE_LIBRARY) {
          if (!libraryByName.has(ex.name)) libraryByName.set(ex.name, ex);
        }

        for (const lift of preset.lifts) {
          const exercise = exerciseByName.get(lift.name) ?? libraryByName.get(lift.name);
          if (!exercise) continue;

          const parsedReps = lift.reps ? Number.parseInt(lift.reps, 10) : null;
          planExercises.push({
            exercise,
            targetSets: Math.max(1, lift.sets ?? 1),
            targetReps: Number.isFinite(parsedReps as number) ? parsedReps : null,
            targetWeightKg: null,
            restSeconds: 90,
            muscleGroup: exercise.muscle_group,
          });
        }
      }

      if (planExercises.length === 0) {
        // No exercises to preview — fall through to direct start
        handleStartWorkout();
        return;
      }

      const muscleGroups = [...new Set(planExercises.map((e) => e.muscleGroup))];

      setWorkoutPlan({
        name,
        source: activeTemplateId ? "template" : "preset",
        sourceId: activeTemplateId ?? presetId,
        exercises: planExercises,
        muscleGroups,
        estimatedDurationMin: estimateWorkoutDuration(planExercises),
      });
      setSetupPhase("plan-preview");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workout";
      toast.error(message);
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleConfirmPlan(plan: WorkoutPlan) {
    if (!userId) return;

    const activeTemplateId = plan.source === "template" ? plan.sourceId : undefined;
    startWorkout(plan.name, userId, activeTemplateId);

    if (userId) {
      void trackSessionIntentSet(supabase, userId, {
        workout_name: plan.name,
        template_id: activeTemplateId ?? null,
        source: activeTemplateId ? "template" : (plan.sourceId ?? "preset"),
      });
    }

    try {
      // Resolve all exercises in batch
      const resolved = await ensureExerciseRecordsBatch(plan.exercises.map((pe) => pe.exercise));

      for (const pe of plan.exercises) {
        const source = resolved.get(exerciseKey(pe.exercise)) ?? pe.exercise;
        addExercise(source);

        const exerciseIndex = useWorkoutStore.getState().activeWorkout?.exercises.length;
        if (!exerciseIndex) continue;
        const index = exerciseIndex - 1;

        updateSet(index, 0, {
          reps: pe.targetReps,
          weight_kg: pe.targetWeightKg,
          rest_seconds: pe.restSeconds,
        });

        for (let i = 1; i < pe.targetSets; i += 1) {
          addSet(index);
          updateSet(index, i, {
            reps: pe.targetReps,
            weight_kg: pe.targetWeightKg,
            rest_seconds: pe.restSeconds,
          });
        }
      }

      await applyAutofillFromHistory();
      toast.success(`Started ${plan.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start workout";
      toast.error(message);
    }

    // Clean up plan state
    setWorkoutPlan(null);
    setSetupPhase("selection");
  }

  function handlePlanSwap(exerciseIndex: number, newExercise: Exercise) {
    setWorkoutPlan((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = {
        ...exercises[exerciseIndex],
        exercise: newExercise,
        muscleGroup: newExercise.muscle_group,
      };
      const muscleGroups = [...new Set(exercises.map((e) => e.muscleGroup))];
      return {
        ...prev,
        exercises,
        muscleGroups,
        estimatedDurationMin: estimateWorkoutDuration(exercises),
      };
    });
    setPlanSwapIndex(null);
  }

  async function handleCreateCustomExercise(name: string, muscleGroup: string, equipment: string): Promise<void> {
    try {
      const customExercise = makeCustomExercise(name, muscleGroup as MuscleGroup, equipment);
      await addExerciseToWorkout(customExercise);
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

  async function handleSaveTemplate(templateName: string, categories: string[] = []) {
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
        is_public: false,
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

  // WakeLock: keep screen on while workout is active
  useEffect(() => {
    if (!isWorkoutActive) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock?.request("screen") ?? null;
      } catch { /* not supported on this device/browser */ }
    };
    acquire();
    return () => { lock?.release().catch(() => {}); };
  }, [isWorkoutActive]);

  // DnD sensors — TouchSensor with 200 ms delay to avoid scroll conflicts
  const dndSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeWorkout) return;
    // IDs are `${exerciseId}-${index}` — extract index from suffix
    const fromIndex = Number((active.id as string).split("-").pop());
    const toIndex = Number((over.id as string).split("-").pop());
    if (Number.isFinite(fromIndex) && Number.isFinite(toIndex) && fromIndex !== toIndex) {
      reorderExercise(fromIndex, toIndex);
    }
  }, [activeWorkout, reorderExercise]);

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

  return (
    <div data-phase="active" className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="sticky top-0 z-40 glass-surface border-b border-[rgba(255,255,255,0.06)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon-container flex h-8 w-8 items-center justify-center rounded-lg">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold font-display tracking-tight">Workout</p>
          </div>
          {isWorkoutActive && activeWorkout ? (
            <div className="flex items-center gap-2">
              <div className="glass-chip inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                <ElapsedTime startedAt={activeWorkout.started_at} className="tabular-nums" />
              </div>
              <div className="glass-chip inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary">
                <Zap className="h-3.5 w-3.5" />
                {plannerStats.completedSets}/{plannerStats.totalSets}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-6 md:px-6 lg:px-10">
        {!isWorkoutActive ? (
          <>
            <TrainSubNav />
            <PageHeader
              title="Workout"
              subtitle="Save templates, reuse them in future sessions, and compare to previous performance."
            />
          </>
        ) : null}

        {!isWorkoutActive && setupPhase === "plan-preview" && workoutPlan ? (
          <div className="mx-auto w-full max-w-3xl">
            <WorkoutPlanCard
              plan={workoutPlan}
              onConfirm={handleConfirmPlan}
              onBack={() => {
                setSetupPhase("selection");
                setWorkoutPlan(null);
              }}
              onSwapExercise={(index) => setPlanSwapIndex(index)}
              onNameChange={(name) =>
                setWorkoutPlan((prev) => (prev ? { ...prev, name } : prev))
              }
            />

            <PlanSwapSheet
              open={planSwapIndex !== null}
              exerciseIndex={planSwapIndex}
              currentExercise={
                planSwapIndex !== null
                  ? (workoutPlan.exercises[planSwapIndex] ?? null)
                  : null
              }
              existingExerciseNames={workoutPlan.exercises.map(
                (pe) => pe.exercise.name
              )}
              onSwap={handlePlanSwap}
              onClose={() => setPlanSwapIndex(null)}
            />
          </div>
        ) : null}

        {!isWorkoutActive && setupPhase === "selection" ? (
          <Card className="mx-auto w-full max-w-3xl overflow-hidden glass-surface-elevated shadow-xl transition-all duration-300">
            <div className="border-b border-[rgba(255,255,255,0.06)] glass-inner px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="glass-icon-container flex h-10 w-10 items-center justify-center rounded-xl">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">New Session</p>
                  <p className="text-xl font-black font-display tracking-tight">Start a Workout</p>
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

              {workoutDraft && !isWorkoutActive && (
                <RestoreWorkoutBanner
                  draft={workoutDraft}
                  onRestore={handleRestoreDraft}
                  onDiscard={handleDiscardDraft}
                />
              )}

              <ActiveProgramCard refreshKey={programRefreshKey} />

              <div className="glass-inner rounded-xl p-1">
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
                  onSelectStartFresh={() => {
                    setSelectedTemplateId("none");
                    setWorkoutName("My Workout");
                    setPendingCategories([]);
                  }}
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
                onClick={handlePreviewPlan}
                disabled={
                  planLoading ||
                  ghostIsLoading ||
                  (setupTab === "templates" &&
                    pendingCategories.length === 0 &&
                    (selectedTemplateId === "none" ||
                      !templates.find((t) => t.id === selectedTemplateId)?.primary_muscle_group))
                }
              >
                {(ghostIsLoading || planLoading) ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Start Workout
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isWorkoutActive && activeWorkout ? (
          <div className="mx-auto max-w-2xl space-y-3">
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

            {/* Workout name inline edit */}
            <div className="flex items-center gap-2 px-1">
              <Input
                value={activeWorkout.name}
                onChange={(e) => updateWorkoutName(e.target.value)}
                className="h-8 flex-1 border-transparent bg-transparent px-0 text-lg font-semibold leading-tight tracking-tight focus:border-border focus:bg-background"
                placeholder="Workout name"
              />
            </div>

            {/* Exercise cards */}
            {activeWorkout.exercises.length === 0 ? (
              <button
                type="button"
                onClick={() => setExerciseLibraryOpen(true)}
                className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                <Plus className="mx-auto h-6 w-6 text-primary" />
                <p className="mt-1.5 text-sm font-semibold text-primary">Add Your First Exercise</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Browse the exercise library or create a custom exercise
                </p>
              </button>
            ) : (
              <div className="space-y-3">
                {/* Reorder toggle */}
                {activeWorkout.exercises.length > 1 && (
                  <div className="flex justify-end px-1">
                    <Button
                      type="button"
                      variant={isReorderMode ? "default" : "ghost"}
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setIsReorderMode((prev) => !prev)}
                    >
                      {isReorderMode ? (
                        <>
                          <Check className="size-3.5" />
                          Done
                        </>
                      ) : (
                        <>
                          <ArrowUpDown className="size-3.5" />
                          Reorder
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {ghostWorkoutData && !isReorderMode ? (
                  <div className="glass-inner rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground">
                    Ghost workout active — training against your last session.
                  </div>
                ) : null}

                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={activeWorkout.exercises.map((e, i) => `${e.exercise.id}-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {isReorderMode ? (
                      <Card className="glass-surface-elevated overflow-hidden divide-y divide-border/40">
                        {activeWorkout.exercises.map((exerciseBlock, exerciseIndex) => (
                          <SortableReorderItem
                            key={`${exerciseBlock.exercise.id}-${exerciseIndex}`}
                            exerciseId={`${exerciseBlock.exercise.id}-${exerciseIndex}`}
                            name={exerciseBlock.exercise.name}
                            completedSets={exerciseBlock.sets.filter((s) => s.completed).length}
                            totalSets={exerciseBlock.sets.length}
                          />
                        ))}
                      </Card>
                    ) : (
                      activeWorkout.exercises.map((exerciseBlock, exerciseIndex) => (
                        <SortableExerciseCard
                          key={`${exerciseBlock.exercise.id}-${exerciseIndex}`}
                          exerciseId={`${exerciseBlock.exercise.id}-${exerciseIndex}`}
                          exerciseBlock={exerciseBlock}
                          exerciseIndex={exerciseIndex}
                          ghostSets={ghostWorkoutData?.exercises[exerciseBlock.exercise.id]}
                          previousSets={previousByExerciseId[exerciseBlock.exercise.id]}
                          suggestedWeights={suggestedWeightsByKey[exerciseBlock.exercise.id]}
                          smartSuggestions={smartSuggestions[exerciseBlock.exercise.id]}
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
                      ))
                    )}
                  </SortableContext>
                </DndContext>

                {/* Add Exercise button */}
                {!isReorderMode && (
                  <button
                    type="button"
                    onClick={() => setExerciseLibraryOpen(true)}
                    className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-7 text-center transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    <Plus className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-1 text-sm font-semibold text-primary">Add Exercise</p>
                  </button>
                )}
              </div>
            )}

            {/* Session Actions */}
            <Card className="glass-surface shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Session Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="space-y-1.5 pb-2.5 border-b border-[rgba(255,255,255,0.06)]">
                  <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <NotebookPen className="h-3 w-3" />
                    Workout notes
                  </Label>
                  <Textarea
                    placeholder="How did the session feel? Any PRs or observations..."
                    value={activeWorkout.notes}
                    onChange={(e) => setWorkoutNote(e.target.value)}
                    className="min-h-[56px] resize-none text-sm"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px] transition-all duration-200 hover:scale-[1.01]"
                    onClick={handleOpenSaveTemplate}
                  >
                    <Save className="mr-1.5 size-3.5" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-h-[44px] transition-all duration-200 hover:scale-[1.01]"
                    onClick={handleCancelWorkout}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-[44px] transition-all duration-200 hover:scale-[1.01]"
                    onClick={handleFinishWorkout}
                  >
                    Finish
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Exercise Library Sheet */}
            <ExerciseLibrarySheet
              open={exerciseLibraryOpen}
              onClose={() => setExerciseLibraryOpen(false)}
              selectedExerciseIds={selectedExerciseIds}
              onAddExercise={async (exercise) => {
                await addExerciseToWorkout(exercise);
              }}
              onCreateCustomExercise={handleCreateCustomExercise}
            />
          </div>
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
          onSend={async (recipientIds, template, message) => {
            await sendTemplateToMany(recipientIds, template!, message);
            toast.success(
              recipientIds.length === 1
                ? "Template sent!"
                : `Template sent to ${recipientIds.length} people!`
            );
          }}
        />

        {/* Workout Complete Celebration */}
        {showCelebration && celebrationStats && (
          <WorkoutCompleteCelebration
            stats={celebrationStats}
            confettiStyle="gold"
            onClose={handleCloseWorkoutCelebration}
            recapData={recapData}
            recapLoading={recapLoading}
            workoutName={celebrationWorkoutName ?? undefined}
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
