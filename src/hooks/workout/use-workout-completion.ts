import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/celebrations";
import {
  logRetentionEvent,
  trackSessionIntentCompleted,
} from "@/lib/retention-events";
import type { ActiveWorkout, WorkoutSet } from "@/types/workout";
import type { WorkoutStats } from "@/components/workout/workout-complete-celebration";
import type { GhostWorkoutData } from "./use-ghost-session";

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string; details?: string };
  const text = `${candidate.message ?? ""} ${candidate.details ?? ""}`.toLowerCase();

  return (
    candidate.code === "PGRST205" ||
    (text.includes("could not find the table") ||
      (text.includes("relation") && text.includes("does not exist")))
  );
}

interface UseWorkoutCompletionArgs {
  supabase: SupabaseClient;
  userId: string | null;
  finishWorkout: (userId: string) => ActiveWorkout | null;
  cancelWorkout: (userId: string) => void;
  previousByExerciseId: Record<string, Array<{ reps: number | null; weight: number | null }>>;
  ghostWorkoutData: GhostWorkoutData;
  toDisplayWeight: (kg: number) => number;
  toDisplayVolume: (kgVolume: number) => number;
  unitLabel: "kg" | "lbs";
  setDbFeaturesAvailable: (v: boolean) => void;
}

export function useWorkoutCompletion({
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
}: UseWorkoutCompletionArgs) {
  const [celebrationStats, setCelebrationStats] = useState<WorkoutStats | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number } | null>(null);
  const [sessionRpePromptOpen, setSessionRpePromptOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [sessionRpeValue, setSessionRpeValue] = useState(7);
  const [savingSessionRpe, setSavingSessionRpe] = useState(false);

  const handleFinishWorkout = useCallback(async () => {
    if (!userId) return;
    const workout = finishWorkout(userId);
    if (!workout) return;

    // Ensure user profile exists (in case the auto-create trigger didn't fire)
    try {
      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to ensure profile exists:", err);
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

          isPR =
            (currentReps === previousReps && currentWeight > previousWeight) ||
            (currentWeight === previousWeight && currentReps > previousReps) ||
            (currentWeight > previousWeight && currentReps > previousReps);

          if (isPR) {
            prCount++;
          }
        }

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
          weight: set.weight_kg != null ? toDisplayWeight(set.weight_kg) : null,
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

    // Snapshot level before completion so we can detect a level-up afterwards
    const { data: levelBefore } = await supabase
      .from("profiles")
      .select("level")
      .eq("id", userId)
      .maybeSingle();
    const levelBeforeCompletion = levelBefore?.level ?? 1;

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

    // Retention micro-win reinforcement
    try {
      const { data: profileSnapshot } = await supabase
        .from("profiles")
        .select("current_streak, level, xp")
        .eq("id", userId)
        .maybeSingle();

      const currentStreak = profileSnapshot?.current_streak ?? 0;
      const level = profileSnapshot?.level ?? null;
      const xp = profileSnapshot?.xp ?? 0;
      const milestones = [7, 30, 100, 365];
      const nextMilestone = milestones.find((m) => m > currentStreak) ?? null;
      const milestoneText =
        nextMilestone != null
          ? `${nextMilestone - currentStreak} days to ${nextMilestone}-day milestone`
          : "Milestone ladder complete";

      const xpAwarded = 100 + (setsCompleted * 2);

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
          xp_awarded: xpAwarded,
        },
      });

      toast.success(`+${xpAwarded} XP earned`, {
        description: level != null ? `Level ${level} • ${xp} XP • ${milestoneText}` : milestoneText,
      });

      // Detect and queue level-up celebration
      if (level != null && level > levelBeforeCompletion) {
        setLevelUpData({ newLevel: level });
      }
    } catch (err) {
      void err;
    }

    // Show celebration modal with stats
    setCelebrationStats({
      duration: durationString,
      exerciseCount: workout.exercises.length,
      totalVolume: toDisplayVolume(totalVolume),
      unitLabel,
      prCount,
      totalSets: allSets.length,
      beatGhostCount: ghostWorkoutData ? beatGhostCount : undefined,
      exercises: exerciseRecap,
    });
    setShowCelebration(true);
    setPendingSessionId(session.id);
  }, [
    userId,
    finishWorkout,
    supabase,
    previousByExerciseId,
    ghostWorkoutData,
    toDisplayWeight,
    toDisplayVolume,
    unitLabel,
    setDbFeaturesAvailable,
  ]);

  const handleCancelWorkout = useCallback(() => {
    if (!userId) return;
    cancelWorkout(userId);
    toast.message("Workout cancelled");
  }, [userId, cancelWorkout]);

  const handleCloseWorkoutCelebration = useCallback(() => {
    setShowCelebration(false);
    setCelebrationStats(null);

    if (levelUpData) {
      // Show level-up modal first; RPE prompt follows after that
      return;
    }

    setTimeout(() => {
      fireConfetti();
      setSessionRpePromptOpen(true);
    }, 650);
  }, [levelUpData]);

  const handleCloseLevelUp = useCallback(() => {
    setLevelUpData(null);
    setTimeout(() => {
      fireConfetti();
      setSessionRpePromptOpen(true);
    }, 650);
  }, []);

  const handleSaveSessionRpe = useCallback(async () => {
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
  }, [pendingSessionId, sessionRpeValue]);

  return {
    // Celebration
    celebrationStats,
    showCelebration,
    levelUpData,
    // RPE prompt
    sessionRpePromptOpen,
    setSessionRpePromptOpen,
    sessionRpeValue,
    setSessionRpeValue,
    savingSessionRpe,
    // Handlers
    handleFinishWorkout,
    handleCancelWorkout,
    handleCloseWorkoutCelebration,
    handleCloseLevelUp,
    handleSaveSessionRpe,
  };
}
