"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ChevronDown, Clock3, NotebookPen, Plus, Save, X, LayoutList, Dumbbell, Layers, CircleCheck, Activity, Zap, Send, Pencil, Copy, Trash2, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fireConfetti } from "@/lib/celebrations";
import {
  logRetentionEvent,
  trackSessionIntentCompleted,
  trackSessionIntentSet,
} from "@/lib/retention-events";
import { useWorkoutStore } from "@/stores/workout-store";
import { useTimerStore } from "@/stores/timer-store";
import type { ActiveWorkout, Exercise } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetRow } from "@/components/workout/set-row";
import { RestTimerPill } from "@/components/workout/rest-timer-pill";
import { FormTipsPanel } from "@/components/workout/form-tips-panel";
import { SaveTemplateDialog } from "@/components/workout/save-template-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SendTemplateDialog } from "@/components/social/send-template-dialog";
import { useSharedItems, type TemplateSnapshot } from "@/hooks/use-shared-items";
import { ExerciseSelectionCard } from "@/components/workout/exercise-selection-card";
import { WorkoutCompleteCelebration } from "@/components/workout/workout-complete-celebration";
import type { WorkoutStats } from "@/components/workout/workout-complete-celebration";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

type WorkoutTemplate = {
  id: string;
  name: string;
};

type WorkoutPresetId =
  | "upper-body-strength"
  | "push-day"
  | "pull-day"
  | "leg-day"
  | "full-body"
  | "arms-shoulders"
  | "custom";

const POPULAR_WORKOUTS: Array<{
  id: Exclude<WorkoutPresetId, "custom">;
  label: string;
  defaultName: string;
  liftNames: string[];
}> = [
  {
    id: "upper-body-strength",
    label: "Upper Body Strength",
    defaultName: "Upper Body Strength",
    liftNames: [
      "Barbell Bench Press",
      "Barbell Bent-Over Row",
      "Seated Dumbbell Press",
      "Lat Pulldown (Wide Grip)",
      "Close-Grip Bench Press",
      "EZ-Bar Curl",
    ],
  },
  {
    id: "push-day",
    label: "Push Day (Chest/Shoulders/Triceps)",
    defaultName: "Push Day",
    liftNames: [
      "Incline Barbell Bench Press",
      "Seated Chest Press Machine",
      "Arnold Press",
      "Dumbbell Lateral Raise",
      "Rope Pushdown",
      "Overhead Dumbbell Extension",
    ],
  },
  {
    id: "pull-day",
    label: "Pull Day (Back/Biceps)",
    defaultName: "Pull Day",
    liftNames: [
      "Conventional Deadlift",
      "Weighted Pull-Ups",
      "Seated Cable Row",
      "Face Pulls",
      "Hammer Curl",
      "Cable Curl",
    ],
  },
  {
    id: "leg-day",
    label: "Leg Day (Quads/Glutes/Hams)",
    defaultName: "Leg Day",
    liftNames: [
      "Barbell Back Squat",
      "Leg Press",
      "Romanian Deadlift",
      "Bulgarian Split Squat",
      "Leg Extension",
      "Seated Leg Curl",
    ],
  },
  {
    id: "full-body",
    label: "Full Body Compound",
    defaultName: "Full Body",
    liftNames: [
      "Trap Bar Deadlift",
      "Barbell Bench Press",
      "Barbell Bent-Over Row",
      "Barbell Overhead Press",
      "Farmer's Carry",
    ],
  },
  {
    id: "arms-shoulders",
    label: "Arms + Delts",
    defaultName: "Arms & Delts",
    liftNames: [
      "EZ-Bar Curl",
      "Incline Dumbbell Curl",
      "Rope Pushdown",
      "Skull Crushers",
      "Dumbbell Lateral Raise",
      "Rear Delt Fly",
    ],
  },
];

const DB_ALLOWED_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "band",
]);
const TEMPLATE_LIKES_KEY = "workout_template_likes_v1";

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string; details?: string };
  const text = `${candidate.message ?? ""} ${candidate.details ?? ""}`.toLowerCase();

  return (
    candidate.code === "PGRST205" ||
    text.includes("could not find the table") ||
    text.includes("relation") && text.includes("does not exist")
  );
}

function ElapsedTime({ startedAt, className }: { startedAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return <span className={className}>{`${pad(hrs)}:${pad(mins)}:${pad(secs)}`}</span>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEquipment(equipment: string | null): string {
  if (!equipment) return "bodyweight";
  return DB_ALLOWED_EQUIPMENT.has(equipment) ? equipment : "bodyweight";
}

function resolveExerciseMediaUrl(
  mediaUrl: string | null | undefined,
  source?: string | null
): string | null {
  if (!mediaUrl) return null;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  if (source === "free-exercise-db") {
    const clean = trimmed.replace(/^\/+/, "");
    return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${clean}`;
  }

  return null;
}

function makeCustomExercise(name: string, muscleGroup: MuscleGroup, equipment: string): Exercise {
  const slugBase = slugify(name);
  return {
    id: `custom-${slugBase}-${Date.now()}`,
    name,
    slug: `${slugBase}-${muscleGroup}`,
    muscle_group: muscleGroup,
    equipment,
    category: "isolation",
    instructions: null,
    form_tips: null,
    image_url: null,
  };
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
  const [workoutName, setWorkoutName] = useState("Upper Body Strength");
  const [setupTab, setSetupTab] = useState<"templates" | "quick">("templates");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateActionBusyId, setTemplateActionBusyId] = useState<string | null>(null);
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(new Set());
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<{
    id: string;
    name: string;
    description: string | null;
    exercises: TemplateSnapshot["exercises"];
  } | null>(null);

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
  const selectedMuscleGroupRef = useRef<MuscleGroup>(selectedMuscleGroup);
  const searchRequestSeq = useRef(0);

  const [previousByExerciseId, setPreviousByExerciseId] = useState<
    Record<string, Array<{ reps: number | null; weight: number | null }>>
  >({});
  const [ghostWorkoutData, setGhostWorkoutData] = useState<{
    sessionDate: string;
    exercises: Record<
      string,
      Array<{ setNumber: number; reps: number | null; weight: number | null }>
    >;
  } | null>(null);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [exerciseLastPerformance, setExerciseLastPerformance] = useState<
    Record<string, { reps: number | null; weight: number | null; performedAt: string | null }>
  >({});
  const [celebrationStats, setCelebrationStats] = useState<WorkoutStats | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sessionRpePromptOpen, setSessionRpePromptOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [sessionRpeValue, setSessionRpeValue] = useState(7);
  const [savingSessionRpe, setSavingSessionRpe] = useState(false);

  const {
    activeWorkout,
    isWorkoutActive,
    startWorkout,
    loadWorkoutForEdit,
    cancelWorkout,
    finishWorkout,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    completeSet,
    setExerciseNote,
    setWorkoutNote,
    updateWorkoutName,
  } = useWorkoutStore();

  const startTimer = useTimerStore((state) => state.startTimer);
  const getActiveTimers = useTimerStore((state) => state.getActiveTimers);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const { sendTemplate } = useSharedItems(userId);

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

  const groupCounts = useMemo(() => {
    const counts: Partial<Record<MuscleGroup, number>> = Object.fromEntries(
      MUSCLE_GROUPS.map((group) => [group, 0])
    ) as Partial<Record<MuscleGroup, number>>;

    for (const exercise of allExercises) {
      const key = exercise.muscle_group as MuscleGroup;
      if (counts[key] == null) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return counts;
  }, [allExercises]);

  const selectedExercise = useMemo(
    () => allExercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [allExercises, selectedExerciseId]
  );

  const selectedExerciseMediaUrl = useMemo(() => {
    if (!selectedExercise) return null;
    return resolveExerciseMediaUrl(
      ("gif_url" in selectedExercise && selectedExercise.gif_url)
        ? selectedExercise.gif_url
        : selectedExercise.image_url,
      ("source" in selectedExercise
        ? (selectedExercise as { source?: string | null }).source
        : null) ?? null
    );
  }, [selectedExercise]);

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

  const loadTemplates = useCallback(async (currentUserId: string) => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from("workout_templates")
      .select("id,name")
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

  useEffect(() => {
    selectedMuscleGroupRef.current = selectedMuscleGroup;
  }, [selectedMuscleGroup]);

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

        // Preserve existing behavior: only pass muscle group when searching
        if (query.length > 0) {
          params.set("query", query);
          params.set("muscle_group", selectedMuscleGroupRef.current);
        }

        const response = await fetch(`/api/exercises/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch exercises");

        const data = await response.json();

        // Prevent stale responses from older requests from overwriting fresh data.
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
  }, [liftSearch]); // Intentional: only search term triggers fetch

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (template) {
      setWorkoutName(template.name);
    }
  }, [selectedTemplateId, templates]);

  // Fetch ghost workout data when template is selected
  useEffect(() => {
    async function loadGhostWorkout() {
      if (selectedTemplateId === "none" || !userId) {
        setGhostWorkoutData(null);
        return;
      }

      try {
        // Get the most recent completed session with this template
        const { data: ghostSession, error: sessionError } = await supabase
          .from("workout_sessions")
          .select("id, started_at")
          .eq("user_id", userId)
          .eq("template_id", selectedTemplateId)
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError || !ghostSession) {
          setGhostWorkoutData(null);
          return;
        }

        // Fetch all sets from that session
        const { data: ghostSets, error: setsError } = await supabase
          .from("workout_sets")
          .select("exercise_id, set_number, reps, weight_kg")
          .eq("session_id", ghostSession.id)
          .order("set_number", { ascending: true });

        if (setsError || !ghostSets) {
          setGhostWorkoutData(null);
          return;
        }

        // Group sets by exercise_id
        const exerciseMap: Record<
          string,
          Array<{ setNumber: number; reps: number | null; weight: number | null }>
        > = {};
        for (const set of ghostSets) {
          if (!exerciseMap[set.exercise_id]) {
            exerciseMap[set.exercise_id] = [];
          }
          exerciseMap[set.exercise_id].push({
            setNumber: set.set_number,
            reps: set.reps,
            weight: set.weight_kg,
          });
        }

        for (const exerciseId of Object.keys(exerciseMap)) {
          exerciseMap[exerciseId].sort((a, b) => a.setNumber - b.setNumber);
        }

        setGhostWorkoutData({
          sessionDate: ghostSession.started_at,
          exercises: exerciseMap,
        });
      } catch (err) {
        console.error("Failed to load ghost workout:", err);
        setGhostWorkoutData(null);
      }
    }

    void loadGhostWorkout();
  }, [selectedTemplateId, userId, supabase]);

  useEffect(() => {
    async function loadPreviousPerformance() {
      if (!userId || !activeWorkout) {
        setPreviousByExerciseId({});
        return;
      }

      // Get all exercise IDs from current workout
      const exerciseIds = activeWorkout.exercises.map(e => e.exercise.id);
      if (exerciseIds.length === 0) {
        setPreviousByExerciseId({});
        return;
      }

      // Load all completed sets, then keep only the most recent completed session per exercise.
      // This supports true set-by-set ghosting instead of a single "best set" only.
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

      // Pick the latest session id for each exercise
      const latestSessionByExercise = new Map<string, string>();
      for (const row of rows) {
        if (!latestSessionByExercise.has(row.exercise_id)) {
          latestSessionByExercise.set(row.exercise_id, row.session_id);
        }
      }

      // Convert to expected format: { exerciseId: [{ reps, weight }, ...] } from latest session only
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
    // Auto-start the workout
    async function autoStart() {
      setHasAutoStarted(true);

      // Case 1: Saved template (from suggestion or alternative)
      if (templateId && templates.length > 0) {
        const template = templates.find(t => t.id === templateId);
        if (!template) {
          console.error('Template not found:', templateId);
          toast.error('Template not found');
          return;
        }

        setSelectedTemplateId(templateId);
        setWorkoutName(template.name);
        await startWorkout(template.name, templateId);

        // Load template exercises from database
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
          toast.success(`Started ${template.name} from ${source} 🚀`);
        } catch (error) {
          console.error('Template load error:', error);
          toast.error('Failed to load template');
        }
        return;
      }

      // Case 2: Preset workout (no template_id)
      const storageKey = fromAdaptive ? 'adaptive_workout' : 'launcher_prediction';
      const workoutDataRaw = sessionStorage.getItem(storageKey);
      if (!workoutDataRaw) return;

      try {
        const launcherData = JSON.parse(workoutDataRaw);
        sessionStorage.removeItem(storageKey);

        setWorkoutName(launcherData.template_name);
        await startWorkout(launcherData.template_name, undefined);

        // Add exercises from launcher prediction
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

        toast.success(`Started ${launcherData.template_name} from launcher 🚀`);
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

  async function handleSendTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: templateExercises, error } = await supabase
        .from("template_exercises")
        .select("exercise_id,target_sets,target_reps,target_weight_kg,exercises(name,muscle_group)")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const exercises: TemplateSnapshot["exercises"] = (templateExercises ?? []).map((row) => {
        const exercise = row.exercises as { name?: string; muscle_group?: string } | null;
        const setCount = Math.max(1, row.target_sets ?? 1);
        const reps = row.target_reps ? Number.parseInt(row.target_reps, 10) : null;
        return {
          exercise_id: row.exercise_id ?? null,
          name: exercise?.name ?? "Exercise",
          muscle_group: exercise?.muscle_group ?? "full_body",
          sets: Array.from({ length: setCount }, () => ({
            reps: Number.isFinite(reps as number) ? reps : null,
            weight_kg: row.target_weight_kg ?? null,
          })),
        };
      });

      setSendingTemplate({
        id: template.id,
        name: template.name,
        description: null,
        exercises,
      });
      setSendDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare template send.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleEditTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: templateExercises, error } = await supabase
        .from("template_exercises")
        .select(
          "sort_order,target_sets,target_reps,target_weight_kg,rest_seconds,exercise_id,exercises(id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url)"
        )
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const designWorkout: ActiveWorkout = {
        id: `template-design-${template.id}`,
        name: template.name,
        template_id: template.id,
        started_at: new Date().toISOString(),
        exercises: [],
        notes: "",
      };

      loadWorkoutForEdit(designWorkout, `template-design-${template.id}`);

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

      toast.success(`Editing ${template.name} in design mode`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open template editor.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleCopyTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    setTemplateActionBusyId(template.id);
    try {
      const { data: sourceRows, error: sourceError } = await supabase
        .from("template_exercises")
        .select("exercise_id,sort_order,target_sets,target_reps,target_weight_kg,rest_seconds")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (sourceError) throw sourceError;

      const { data: createdTemplate, error: createError } = await supabase
        .from("workout_templates")
        .insert({
          user_id: userId,
          name: `${template.name} Copy`,
          description: `Copied from ${template.name}`,
        })
        .select("id")
        .single();

      if (createError || !createdTemplate) throw createError ?? new Error("Template copy failed.");

      if ((sourceRows ?? []).length > 0) {
        const copiedRows = (sourceRows ?? []).map((row) => ({
          template_id: createdTemplate.id,
          exercise_id: row.exercise_id,
          sort_order: row.sort_order,
          target_sets: row.target_sets,
          target_reps: row.target_reps,
          target_weight_kg: row.target_weight_kg,
          rest_seconds: row.rest_seconds,
        }));

        const { error: copyRowsError } = await supabase.from("template_exercises").insert(copiedRows);
        if (copyRowsError) throw copyRowsError;
      }

      await loadTemplates(userId);
      toast.success("Template copied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy template.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function handleDeleteTemplate(template: WorkoutTemplate) {
    if (!userId) return;
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;

    setTemplateActionBusyId(template.id);
    try {
      await supabase.from("template_exercises").delete().eq("template_id", template.id);

      const { error } = await supabase
        .from("workout_templates")
        .delete()
        .eq("id", template.id)
        .eq("user_id", userId);
      if (error) throw error;

      if (selectedTemplateId === template.id) {
        setSelectedTemplateId("none");
      }
      setLikedTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });

      await loadTemplates(userId);
      toast.success("Template deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete template.";
      toast.error(message);
    } finally {
      setTemplateActionBusyId(null);
    }
  }

  async function ensureExerciseRecord(exercise: Exercise) {
    const SELECT_COLS =
      "id,name,slug,muscle_group,equipment,category,instructions,form_tips,image_url";
    const candidateSlug = `${slugify(exercise.name)}-${exercise.muscle_group}`;

    // 1. Look up by slug first (the unique constraint column) — covers any prior creator
    const { data: bySlug, error: slugError } = await supabase
      .from("exercises")
      .select(SELECT_COLS)
      .eq("slug", candidateSlug)
      .maybeSingle();

    if (slugError) {
      if (isMissingTableError(slugError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
      // non-fatal — fall through to name lookup
    }

    if (bySlug) return bySlug as unknown as Exercise;

    // 2. Fallback lookup by name + muscle_group (handles slug mismatch edge cases)
    const { data: byName } = await supabase
      .from("exercises")
      .select(SELECT_COLS)
      .eq("name", exercise.name)
      .eq("muscle_group", exercise.muscle_group)
      .limit(1)
      .maybeSingle();

    if (byName) return byName as unknown as Exercise;

    // 3. Not found — insert once, with no onConflict to avoid the RLS-blocked UPDATE path
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
      .select(SELECT_COLS)
      .single();

    if (insertError) {
      if (isMissingTableError(insertError)) {
        setDbFeaturesAvailable(false);
        return exercise;
      }
      // Race condition or another constraint — re-fetch by slug as last resort
      const { data: reFetch } = await supabase
        .from("exercises")
        .select(SELECT_COLS)
        .eq("slug", candidateSlug)
        .maybeSingle();
      if (reFetch) return reFetch as unknown as Exercise;
      return exercise;
    }

    return inserted as unknown as Exercise;
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

  async function handleStartWorkout() {
    const name = workoutName.trim() || "Workout";
    const activeTemplateId = selectedTemplateId === "none" ? undefined : selectedTemplateId;

    await startWorkout(name, activeTemplateId);
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

        for (const row of templateExercises ?? []) {
          const exercise = row.exercises as unknown as Exercise | null;
          if (!exercise) continue;

          await addExerciseToWorkout(exercise, {
            targetSets: row.target_sets,
            targetReps: row.target_reps,
            targetWeight: row.target_weight_kg,
            restSeconds: row.rest_seconds,
            silent: true,
          });
        }

        toast.success(`Started ${name} from saved template`);
        return;
      }

      if (presetId !== "custom") {
        const preset = POPULAR_WORKOUTS.find((item) => item.id === presetId);

        for (const liftName of preset?.liftNames ?? []) {
          const exercise = allExercises.find((item) => item.name === liftName);
          if (!exercise) continue;
          await addExerciseToWorkout(exercise, { silent: true });
        }
      }

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

  async function handleSaveTemplate(templateName: string) {
    if (!activeWorkout || !userId) {
      toast.error("Start a workout first.");
      return;
    }

    // Ensure user profile exists (in case the auto-create trigger didn't fire)
    try {
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to ensure profile exists:", err);
      // Continue anyway — it might already exist
    }

    const { data: createdTemplate, error: templateError } = await supabase
      .from("workout_templates")
      .insert({
        user_id: userId,
        name: templateName.trim(),
        description: `Saved from ${activeWorkout.name}`,
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

  async function handleFinishWorkout() {
    const workout = await finishWorkout();
    if (!workout || !userId) return;

    // Ensure user profile exists (in case the auto-create trigger didn't fire)
    try {
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to ensure profile exists:", err);
      // Continue anyway — it might already exist
    }

    const allSets = workout.exercises.flatMap((exerciseBlock) => exerciseBlock.sets);
    const totalVolume = allSets.reduce((acc, set) => acc + (set.weight_kg ?? 0) * (set.reps ?? 0), 0);

    // Calculate PRs and build exercise recap data
    let prCount = 0;
    let beatGhostCount = 0;
    const exerciseRecap = workout.exercises.map((exerciseBlock) => {
      const previousSets = previousByExerciseId[exerciseBlock.exercise.id] ?? [];
      const previousBest = previousSets.reduce<{ reps: number | null; weight: number | null } | null>(
        (best, set) => {
          const setScore =
            set.weight != null && set.reps != null ? set.weight * set.reps : -1;
          const bestScore =
            best && best.weight != null && best.reps != null ? best.weight * best.reps : -1;
          return setScore > bestScore ? set : best;
        },
        null
      );
      const ghostSets = ghostWorkoutData?.exercises[exerciseBlock.exercise.id] ?? [];
      const ghostSetByNumber = new Map(ghostSets.map((gs) => [gs.setNumber, gs]));
      let beatGhostForExercise = false;

      const setsWithPRFlags = exerciseBlock.sets.map((set) => {
        let isPR = false;

        if (set.completed && previousBest) {
          const currentWeight = set.weight_kg ?? 0;
          const currentReps = set.reps ?? 0;
          const previousWeight = previousBest.weight ?? 0;
          const previousReps = previousBest.reps ?? 0;

          // PR if: (same reps + more weight) OR (same weight + more reps) OR (more weight + more reps)
          isPR =
            (currentReps === previousReps && currentWeight > previousWeight) ||
            (currentWeight === previousWeight && currentReps > previousReps) ||
            (currentWeight > previousWeight && currentReps > previousReps);

          if (isPR) {
            prCount++;
          }
        }

        // Ghost comparison for this specific set
        const ghostSet = ghostSetByNumber.get(set.set_number);
        if (
          set.completed &&
          ghostSet &&
          ghostSet.weight != null &&
          ghostSet.reps != null &&
          set.weight_kg != null &&
          set.reps != null
        ) {
          const currentScore = (set.weight_kg ?? 0) * (set.reps ?? 0);
          const ghostScore = (ghostSet.weight ?? 0) * (ghostSet.reps ?? 0);
          if (currentScore > ghostScore) {
            beatGhostForExercise = true;
          }
        }

        return {
          reps: set.reps,
          weight: set.weight_kg ? Math.round(set.weight_kg * 2.20462) : null, // Convert kg to lbs
          completed: set.completed,
          isPR,
        };
      });

      if (beatGhostForExercise) {
        beatGhostCount++;
      }

      return {
        name: exerciseBlock.exercise.name,
        sets: setsWithPRFlags,
      };
    });

    // Calculate duration
    const durationMs = Date.now() - new Date(workout.started_at).getTime();
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const durationString =
      hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const nowIso = new Date().toISOString();

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        template_id: workout.template_id,
        name: workout.name,
        status: "in_progress",
        started_at: workout.started_at,
        completed_at: null,
        duration_seconds: null,
        total_volume_kg: null,
        notes: workout.notes,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      if (sessionError && isMissingTableError(sessionError)) {
        setDbFeaturesAvailable(false);
        toast.message(
          `${workout.name} finished locally, but history sync is unavailable until migrations are applied.`
        );
        return;
      }
      toast.error(sessionError?.message ?? "Failed to save workout session.");
      return;
    }

    let sortOrder = 0;
    const setRows = workout.exercises.flatMap((exerciseBlock) =>
      exerciseBlock.sets.map((set) => {
        sortOrder += 1;
        return {
          session_id: session.id,
          exercise_id: exerciseBlock.exercise.id,
          set_number: set.set_number,
          set_type: set.set_type,
          reps: set.reps,
          weight_kg: set.weight_kg,
          rir: set.rir,
          rest_seconds: set.rest_seconds,
          completed_at: set.completed ? set.completed_at ?? nowIso : null,
          sort_order: sortOrder,
        };
      })
    );

    const { error: setsError } = await supabase.from("workout_sets").insert(setRows);

    if (setsError) {
      if (isMissingTableError(setsError)) {
        setDbFeaturesAvailable(false);
        toast.message(
          `${workout.name} finished locally, but set history sync is unavailable until migrations are applied.`
        );
        return;
      }
      toast.error(setsError.message);
      return;
    }

    const { error: completeError } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        completed_at: nowIso,
        duration_seconds: Math.max(
          0,
          Math.floor((new Date(nowIso).getTime() - new Date(workout.started_at).getTime()) / 1000)
        ),
        total_volume_kg: Number(totalVolume.toFixed(2)),
        notes: workout.notes,
      })
      .eq("id", session.id)
      .eq("user_id", userId);

    if (completeError) {
      toast.error(completeError.message ?? "Workout saved, but completion sync failed.");
      return;
    }

    const setsCompleted = workout.exercises.flatMap((exercise) => exercise.sets).filter(
      (set) => set.completed
    ).length;

    void trackSessionIntentCompleted(supabase, userId, {
      workout_name: workout.name,
      template_id: workout.template_id ?? null,
      exercise_count: workout.exercises.length,
      completed_sets: setsCompleted,
      total_volume_kg: Number(totalVolume.toFixed(2)),
      duration_seconds: Math.max(
        0,
        Math.floor((new Date(nowIso).getTime() - new Date(workout.started_at).getTime()) / 1000)
      ),
    });

    // Investment loop: automatically seed a next-session intent for tomorrow.
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const intentDate = tomorrow.toISOString().slice(0, 10);
      await supabase.from("user_intents").insert({
        user_id: userId,
        intent_type: "next_session_commitment",
        intent_for_date: intentDate,
        source_screen: "workout",
        intent_payload: {
          previous_workout_name: workout.name,
          suggested_goal: "Complete one focused session",
          suggested_duration_min: 20,
        },
      });
    } catch {
      // Optional table (migration 035); keep workout flow resilient.
    }

    // Retention micro-win reinforcement: summarize immediate progress signals.
    try {
      const { data: profileSnapshot } = await supabase
        .from("profiles")
        .select("current_streak, level")
        .eq("id", userId)
        .maybeSingle();

      const currentStreak = profileSnapshot?.current_streak ?? 0;
      const level = profileSnapshot?.level ?? null;
      const milestones = [7, 30, 100, 365];
      const nextMilestone = milestones.find((m) => m > currentStreak) ?? null;
      const milestoneText =
        nextMilestone != null
          ? `${nextMilestone - currentStreak} days to ${nextMilestone}-day milestone`
          : "Milestone ladder complete";

      void logRetentionEvent(supabase, {
        userId,
        eventType: "micro_win_shown",
        sourceScreen: "workout",
        metadata: {
          streak: currentStreak,
          level,
          next_milestone: nextMilestone,
          pr_count: prCount,
          beat_ghost_count: ghostWorkoutData ? beatGhostCount : 0,
          workout_name: workout.name,
          completed_sets: setsCompleted,
        },
      });

      toast.success("Micro win locked: +50 XP and streak protected.", {
        description: level != null ? `Level ${level} • ${milestoneText}` : milestoneText,
      });
    } catch (err) {
      console.error("Failed to load micro-win snapshot:", err);
    }

    // Show celebration modal with stats
    setCelebrationStats({
      duration: durationString,
      exerciseCount: workout.exercises.length,
      totalVolume: Math.round(totalVolume * 2.20462), // Convert kg to lbs for display
      prCount,
      totalSets: allSets.length,
      beatGhostCount: ghostWorkoutData ? beatGhostCount : undefined,
      exercises: exerciseRecap,
    });
    setShowCelebration(true);
    setPendingSessionId(session.id);
  }

  async function handleCancelWorkout() {
    await cancelWorkout();
    toast.message("Workout cancelled");
  }

  function handleCloseWorkoutCelebration() {
    setShowCelebration(false);
    setCelebrationStats(null);

    // Open the second popup only after the first one is closed.
    setTimeout(() => {
      fireConfetti();
      setSessionRpePromptOpen(true);
    }, 650);
  }

  async function handleSaveSessionRpe() {
    if (!pendingSessionId) return;

    setSavingSessionRpe(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch("/api/fatigue/session-rpe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pendingSessionId,
          session_rpe: sessionRpeValue,
          timezone,
        }),
      });

      if (!response.ok) throw new Error("Could not save session effort");

      toast.success("Session effort saved.");
      setSessionRpePromptOpen(false);
      setPendingSessionId(null);
    } catch (error) {
      console.error("Failed to save session effort:", error);
      toast.error("Could not save session effort");
    } finally {
      setSavingSessionRpe(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
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
                  onClick={() => setSetupTab("templates")}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${
                    setupTab === "templates"
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
                  }}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${
                    setupTab === "quick"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/70"
                  }`}
                >
                  Quick Start
                </button>
              </div>
            </div>

            {setupTab === "templates" ? (
              <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="saved-template"
                    className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    Template Selection
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowTemplateManager((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LayoutList className="size-3" />
                    {showTemplateManager ? "Hide Manager" : "Template Manager"}
                  </button>
                </div>
                {showTemplateManager ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {loadingTemplates ? (
                      <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                        Loading templates...
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
                        No templates yet.
                      </div>
                    ) : (
                      templates.map((template) => (
                        <div
                          key={template.id}
                          className={`rounded-xl border px-3 py-2 transition ${
                            selectedTemplateId === template.id
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/70 bg-card/70"
                          }`}
                        >
                          <p className="truncate text-sm font-semibold">{template.name}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSendTemplate(template)}
                              disabled={templateActionBusyId === template.id}
                              className="h-7 px-2 text-xs"
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Send
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEditTemplate(template)}
                              disabled={templateActionBusyId === template.id}
                              className="h-7 px-2 text-xs"
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCopyTemplate(template)}
                              disabled={templateActionBusyId === template.id}
                              className="h-7 px-2 text-xs"
                            >
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTemplate(template)}
                              disabled={templateActionBusyId === template.id}
                              className="h-7 px-2 text-xs"
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={likedTemplateIds.has(template.id) ? "default" : "secondary"}
                              onClick={() => handleToggleTemplateLike(template.id)}
                              className="h-7 px-2 text-xs"
                            >
                              <Heart className="mr-1 h-3 w-3" />
                              {likedTemplateIds.has(template.id) ? "Liked" : "Like"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateId("none")}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      selectedTemplateId === "none"
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/70 bg-card/70 hover:bg-card"
                    }`}
                  >
                    <p className="text-sm font-semibold">Start Fresh</p>
                    <p className="text-xs text-muted-foreground">No template preloaded</p>
                  </button>
                  {loadingTemplates ? (
                    <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                      Loading templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
                      No templates yet. Use Template Manager above to create one here.
                    </div>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setWorkoutName(template.name);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setSelectedTemplateId(template.id);
                          setWorkoutName(template.name);
                        }}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          selectedTemplateId === template.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/70 bg-card/70 hover:bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{template.name}</p>
                          <div className="flex items-center gap-1">
                            {likedTemplateIds.has(template.id) ? (
                              <Heart className="h-3.5 w-3.5 text-rose-400" />
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Tap to preload</p>
                        <div className="mt-1.5 flex gap-1.5">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleTemplateLike(template.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              event.stopPropagation();
                              handleToggleTemplateLike(template.id);
                            }}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                              likedTemplateIds.has(template.id)
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                                : "border-border/70 text-muted-foreground"
                            }`}
                          >
                            <Heart className="h-3 w-3" />
                            Like
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-3">
                <Label
                  htmlFor="preset"
                  className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                >
                  Choose a Preset
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {POPULAR_WORKOUTS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        presetId === preset.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/70 bg-card/70 hover:bg-card"
                      }`}
                    >
                      <p className="text-xs font-semibold leading-snug">{preset.defaultName}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {preset.liftNames.length} exercises
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        {preset.liftNames.slice(0, 2).map((lift) => (
                          <p key={lift} className="truncate text-[10px] text-muted-foreground/90">
                            • {lift}
                          </p>
                        ))}
                        {preset.liftNames.length > 2 ? (
                          <p className="text-[10px] text-muted-foreground/80">
                            +{preset.liftNames.length - 2} more
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePresetChange("custom")}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      presetId === "custom"
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/70 bg-card/70 hover:bg-card"
                    }`}
                  >
                    <p className="text-xs font-semibold">Custom</p>
                    <p className="text-[10px] text-muted-foreground">Start empty workout</p>
                  </button>
                </div>
                <Select
                  value={presetId}
                  onValueChange={(value) => handlePresetChange(value as WorkoutPresetId)}
                >
                  <SelectTrigger id="preset" className="w-full">
                    <SelectValue placeholder="Select a popular workout" />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_WORKOUTS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom (empty workout)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            <Button className="h-11 w-full text-base font-semibold" onClick={handleStartWorkout}>
              Start Workout
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isWorkoutActive && activeWorkout ? (
        <>
          <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active Session</p>
                  <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">
                    {activeWorkout.name}
                  </h2>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <Clock3 className="size-4" />
                  <ElapsedTime startedAt={activeWorkout.started_at} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
                  <Activity className="mr-1 h-3.5 w-3.5" />
                  {Math.round(plannerStats.totalVolumeKg).toLocaleString()} kg
                </Badge>
                <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  <CircleCheck className="mr-1 h-3.5 w-3.5" />
                  {plannerStats.completedSets} done
                </Badge>
                <Badge className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-300">
                  <Layers className="mr-1 h-3.5 w-3.5" />
                  {plannerStats.totalSets} total sets
                </Badge>
                <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-300">
                  <Dumbbell className="mr-1 h-3.5 w-3.5" />
                  {plannerStats.exercises} exercises
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>Session Progress</span>
                  <span>{completionProgressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: `${completionProgressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target muscle group</Label>
                  <Select
                    value={selectedMuscleGroup}
                    onValueChange={(value) => {
                      setSelectedMuscleGroup(value as MuscleGroup);
                      setSelectedExerciseId("");
                      setLiftSearch("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose muscle group" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSCLE_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {MUSCLE_GROUP_LABELS[group]} ({groupCounts[group] ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Available lifts</Label>
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
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedExercise ? (
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <div className="flex items-center gap-3">
                    {selectedExerciseMediaUrl ? (
                      <Image
                        src={selectedExerciseMediaUrl}
                        alt={selectedExercise.name}
                        width={64}
                        height={64}
                        unoptimized
                        className="size-16 rounded-md object-cover bg-muted shrink-0"
                      />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-md bg-muted">
                        <Dumbbell className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{selectedExercise.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {MUSCLE_GROUP_LABELS[selectedExercise.muscle_group as MuscleGroup] ?? selectedExercise.muscle_group}
                        {selectedExercise.equipment
                          ? ` · ${EQUIPMENT_LABELS[selectedExercise.equipment] ?? selectedExercise.equipment}`
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
                      <Card
                        key={exerciseBlock.exercise.id}
                        className="overflow-hidden border-border/70 bg-card/90 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/30 hover:shadow-lg"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-accent" />
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between text-[20px] font-semibold tracking-tight">
                            <div>
                              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                                  {exerciseBlock.exercise.category}
                                </Badge>
                                {exerciseBlock.exercise.equipment ? (
                                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                                    {EQUIPMENT_LABELS[exerciseBlock.exercise.equipment] ?? exerciseBlock.exercise.equipment}
                                  </Badge>
                                ) : null}
                              </div>
                              <p>{exerciseBlock.exercise.name}</p>
                              {previousByExerciseId[exerciseBlock.exercise.id]?.length ? (
                                <p className="mt-1 text-xs font-normal text-muted-foreground">
                                  Ghost: last session sets loaded
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-lg font-bold leading-none text-primary">
                                  {exerciseBlock.sets.filter((set) => set.completed).length}
                                  <span className="text-sm font-medium text-muted-foreground">/{exerciseBlock.sets.length}</span>
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">sets done</p>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeExercise(exerciseIndex)}
                              >
                                <X className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        {/* Form Tips Panel */}
                        {exerciseBlock.exercise.form_tips && exerciseBlock.exercise.form_tips.length > 0 && (
                          <FormTipsPanel
                            exerciseName={exerciseBlock.exercise.name}
                            formTips={exerciseBlock.exercise.form_tips}
                          />
                        )}
                        <CardContent className="space-y-3 px-5 pb-5">
                          {ghostWorkoutData?.exercises[exerciseBlock.exercise.id]?.length ? (
                            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-300/80">
                                Last Session Set Ladder
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {ghostWorkoutData.exercises[exerciseBlock.exercise.id]
                                  .slice()
                                  .sort((a, b) => a.setNumber - b.setNumber)
                                  .map((ghostSet) => (
                                    <span
                                      key={`${exerciseBlock.exercise.id}-ghost-${ghostSet.setNumber}`}
                                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200"
                                    >
                                      <span className="font-semibold">S{ghostSet.setNumber}</span>
                                      <span className="text-cyan-100/90">
                                        {ghostSet.weight ?? "—"} x {ghostSet.reps ?? "—"}
                                      </span>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                          {exerciseBlock.sets.map((set, setIndex) => {
                            const matchedGhostSet = ghostWorkoutData?.exercises[
                              exerciseBlock.exercise.id
                            ]?.find((ghostSet) => ghostSet.setNumber === set.set_number);
                            return (
                              <SetRow
                                key={set.id}
                                set={set}
                                previousSet={previousByExerciseId[exerciseBlock.exercise.id]?.[setIndex]}
                                ghostSet={
                                  matchedGhostSet
                                    ? {
                                        reps: matchedGhostSet.reps,
                                        weight: matchedGhostSet.weight,
                                      }
                                    : undefined
                                }
                                autoFocusWeight={setIndex === exerciseBlock.sets.length - 1 && !set.completed}
                                onUpdate={(updates) => updateSet(exerciseIndex, setIndex, updates)}
                                onComplete={() => completeSet(exerciseIndex, setIndex)}
                                onRemove={() => removeSet(exerciseIndex, setIndex)}
                                onStartRest={(seconds) => {
                                  const activeTimers = getActiveTimers();
                                  for (const timer of activeTimers) {
                                    stopTimer(timer.id);
                                  }
                                  startTimer(
                                    exerciseBlock.exercise.id,
                                    exerciseBlock.exercise.name,
                                    seconds
                                  );
                                }}
                              />
                            );
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full transition-all duration-200 hover:scale-[1.01]"
                            onClick={() => addSet(exerciseIndex)}
                          >
                            Add Set
                          </Button>
                          {/* Exercise Notes */}
                          <div className="space-y-1.5 pt-1">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <NotebookPen className="h-3 w-3" />
                              Exercise notes
                            </Label>
                            <Textarea
                              placeholder="Notes for this exercise (optional)..."
                              value={exerciseBlock.notes}
                              onChange={(e) => setExerciseNote(exerciseIndex, e.target.value)}
                              className="min-h-[60px] resize-none text-sm"
                              rows={2}
                            />
                          </div>
                        </CardContent>
                      </Card>
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

      <Dialog open={sessionRpePromptOpen} onOpenChange={setSessionRpePromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Session Effort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quick post-session rating. This improves your fatigue estimate.
            </p>
            <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">What is sRPE?</p>
              <p className="mt-1">
                sRPE means <span className="font-semibold">Session Rate of Perceived Exertion</span>:
                how hard the <span className="font-semibold">entire workout</span> felt on a 0-10
                scale.
              </p>
              <p className="mt-1">
                0-2 = very easy, 3-5 = moderate, 6-8 = hard, 9-10 = near max effort.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Session RPE</span>
                <span className="font-semibold tabular-nums">{sessionRpeValue.toFixed(1)}</span>
              </div>
              <Slider
                min={0}
                max={10}
                step={0.5}
                value={[sessionRpeValue]}
                onValueChange={(value) => setSessionRpeValue(value[0] ?? 7)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Very easy</span>
                <span>Max effort</span>
              </div>
            </div>
            <Button onClick={handleSaveSessionRpe} disabled={savingSessionRpe} className="w-full">
              {savingSessionRpe ? "Saving..." : "Save Effort"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Rest Timer Pill */}
      <RestTimerPill />
      </div>
    </div>
  );
}
