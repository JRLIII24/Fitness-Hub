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
      <div className="sticky top-0 z-40 glass-surface border-b border-[rgba(255,255,255,0.06)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="glass-icon-container flex h-8 w-8 items-center justify-center rounded-lg">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold font-display tracking-tight">Workout</p>
          </div>
          {isWorkoutActive && activeWorkout ? (
            <div className="glass-chip inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-primary">
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
              <Card className="h-fit glass-surface shadow-sm transition-all duration-300 lg:sticky lg:top-20">
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
                    <div className="glass-inner rounded-xl p-3">
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
                <Card className="glass-surface">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[20px] font-bold font-display tracking-tight">Exercises</CardTitle>
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
                          <div className="glass-inner rounded-lg px-3 py-2 text-xs text-muted-foreground">
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

                <Card className="glass-surface shadow-sm lg:sticky lg:top-20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Session Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Workout Notes */}
                    <div className="space-y-1.5 pb-3 border-b border-[rgba(255,255,255,0.06)]">
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
