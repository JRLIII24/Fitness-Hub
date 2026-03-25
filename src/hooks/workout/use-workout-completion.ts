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
import type { WorkoutRecap } from "@/components/workout/workout-recap-card";
import type { GhostWorkoutData } from "./use-ghost-session";
import { WORKOUT_RECAP_ENABLED } from "@/lib/features";
import { enqueueMutation } from "@/lib/offline/queue";
import type { SaveWorkoutPayload } from "@/lib/offline/queue.types";
import { uuid } from "@/lib/uuid";

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
  snapshotWorkout: () => ActiveWorkout | null;
  clearWorkout: (userId: string) => void;
  cancelWorkout: (userId: string) => void;
  previousByExerciseId: Record<string, Array<{ reps: number | null; weight: number | null }>>;
  ghostWorkoutData: GhostWorkoutData;
  toDisplayWeight: (kg: number) => number;
  toDisplayVolume: (kgVolume: number) => number;
  unitLabel: "kg" | "lbs";
  setDbFeaturesAvailable: (v: boolean) => void;
  onProgramAdvanced?: () => void;
}

export function useWorkoutCompletion({
  supabase,
  userId,
  snapshotWorkout,
  clearWorkout,
  cancelWorkout,
  previousByExerciseId,
  ghostWorkoutData,
  toDisplayWeight,
  toDisplayVolume,
  unitLabel,
  setDbFeaturesAvailable,
  onProgramAdvanced,
}: UseWorkoutCompletionArgs) {
  const [celebrationStats, setCelebrationStats] = useState<WorkoutStats | null>(null);
  const [celebrationWorkoutName, setCelebrationWorkoutName] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number } | null>(null);
  const [sessionRpePromptOpen, setSessionRpePromptOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [sessionRpeValue, setSessionRpeValue] = useState(7);
  const [savingSessionRpe, setSavingSessionRpe] = useState(false);
  const [recapData, setRecapData] = useState<WorkoutRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);

  const handleFinishWorkout = useCallback(async () => {
    if (!userId) return;
    const workout = snapshotWorkout();
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
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;

    // Build set rows used for both online save and offline queue
    let sortOrder = 0;
    const queueSetRows = workout.exercises.flatMap((exerciseBlock) =>
      exerciseBlock.sets.map((set) => {
        sortOrder += 1;
        return {
          exerciseId: exerciseBlock.exercise.id,
          setNumber: set.set_number,
          setType: set.set_type,
          weightKg: set.weight_kg,
          reps: set.reps,
          rir: set.rir,
          restSeconds: set.rest_seconds,
          completedAt: set.completed ? set.completed_at ?? nowIso : null,
          sortOrder: sortOrder,
        };
      })
    );

    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(nowIso).getTime() - new Date(workout.started_at).getTime()) / 1000)
    );

    // ---- OFFLINE PATH: queue mutation and show celebration immediately ----
    if (!isOnline) {
      const offlineSessionId = uuid();
      const queuePayload: SaveWorkoutPayload = {
        userId,
        sessionId: offlineSessionId,
        templateId: workout.template_id ?? null,
        name: workout.name,
        startedAt: workout.started_at,
        endedAt: nowIso,
        durationSeconds,
        totalVolumeKg: Number(totalVolume.toFixed(2)),
        notes: workout.notes ?? "",
        workoutType: workout.workout_type ?? null,
        setRows: queueSetRows,
      };

      await enqueueMutation("SAVE_WORKOUT_SESSION", queuePayload, offlineSessionId);
      clearWorkout(userId);
      void fetch("/api/workout/draft", { method: "DELETE" }).catch(() => {});

      toast.info("Workout saved offline", {
        description: "It will sync automatically when you reconnect.",
        duration: 5000,
      });

      // Show celebration even when offline
      setCelebrationWorkoutName(workout.name);
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
      // No pendingSessionId — RPE prompt will be skipped offline
      return;
    }

    // ---- ONLINE PATH: show celebration immediately, then save in background ----
    setCelebrationWorkoutName(workout.name);
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
        workout_type: workout.workout_type ?? null,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      // If the online save fails due to network issues, fall back to offline queue
      if (sessionError && !isMissingTableError(sessionError)) {
        const offlineSessionId = uuid();
        const queuePayload: SaveWorkoutPayload = {
          userId,
          sessionId: offlineSessionId,
          templateId: workout.template_id ?? null,
          name: workout.name,
          startedAt: workout.started_at,
          endedAt: nowIso,
          durationSeconds,
          totalVolumeKg: Number(totalVolume.toFixed(2)),
          notes: workout.notes ?? "",
          workoutType: workout.workout_type ?? null,
          setRows: queueSetRows,
        };

        try {
          await enqueueMutation("SAVE_WORKOUT_SESSION", queuePayload, offlineSessionId);
          clearWorkout(userId);
          void fetch("/api/workout/draft", { method: "DELETE" }).catch(() => {});
          toast.info("Workout saved offline", {
            description: "It will sync automatically when you reconnect.",
            duration: 5000,
          });
          // Celebration already shown above
          return;
        } catch {
          // If even queueing fails, show the original error
        }
      }

      if (sessionError && isMissingTableError(sessionError)) {
        clearWorkout(userId);
        setDbFeaturesAvailable(false);
        toast.message(
          `${workout.name} finished locally, but history sync is unavailable until migrations are applied.`
        );
        return;
      }
      toast.error(sessionError?.message ?? "Failed to save workout session. Your progress is preserved — try again.");
      return;
    }

    const dbSetRows = queueSetRows.map((s) => ({
      session_id: session.id,
      exercise_id: s.exerciseId,
      set_number: s.setNumber,
      set_type: s.setType,
      reps: s.reps,
      weight_kg: s.weightKg,
      rir: s.rir,
      rest_seconds: s.restSeconds,
      completed_at: s.completedAt,
      sort_order: s.sortOrder,
    }));

    const { error: setsError } = await supabase.from("workout_sets").insert(dbSetRows);

    if (setsError) {
      if (isMissingTableError(setsError)) {
        clearWorkout(userId);
        setDbFeaturesAvailable(false);
        toast.message(
          `${workout.name} finished locally, but set history sync is unavailable until migrations are applied.`
        );
        return;
      }
      toast.error(setsError.message ?? "Failed to save sets. Your progress is preserved — try again.");
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
        duration_seconds: durationSeconds,
        total_volume_kg: Number(totalVolume.toFixed(2)),
        notes: workout.notes,
      })
      .eq("id", session.id)
      .eq("user_id", userId);

    if (completeError) {
      toast.error(completeError.message ?? "Workout saved, but completion sync failed. Your progress is preserved — try again.");
      return;
    }

    // DB save confirmed — safe to clear local state and draft
    clearWorkout(userId);
    void fetch("/api/workout/draft", { method: "DELETE" }).catch(() => {});

    // Auto-advance training program if this workout is linked to one.
    // Awaited so the next day's template exists before the card re-mounts.
    let programCompleted = false;
    if (workout.template_id) {
      try {
        const advRes = await fetch("/api/programs/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: workout.template_id }),
        });
        const advData = await advRes.json() as { advanced?: boolean; completed?: boolean };
        if (advData.completed) {
          programCompleted = true;
        } else if (advData.advanced) {
          toast.success("Next session ready in your program.");
        }
        if (advData.advanced || advData.completed) {
          onProgramAdvanced?.();
        }
      } catch {
        // non-critical — advance failures don't block the celebration
      }
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
      duration_seconds: durationSeconds,
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

    // Set session ID for RPE prompt (celebration already shown above)
    setPendingSessionId(session.id);

    if (programCompleted) {
      toast.success("Program complete! All weeks finished.", { duration: 5000 });
    }

    // Fire async AI recap (non-blocking)
    if (WORKOUT_RECAP_ENABLED) {
      setRecapLoading(true);
      fetch("/api/ai/workout-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.recap) setRecapData(data.recap);
        })
        .catch(() => {})
        .finally(() => setRecapLoading(false));
    }
  }, [
    userId,
    snapshotWorkout,
    clearWorkout,
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

      // Fire-and-forget: generate AI session summary for coach episodic memory
      // keepalive ensures the request completes even if the user closes the tab
      fetch(`/api/workout/${pendingSessionId}/summarize`, {
        method: "POST",
        keepalive: true,
      });

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
    celebrationWorkoutName,
    showCelebration,
    levelUpData,
    // AI Recap
    recapData,
    recapLoading,
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
