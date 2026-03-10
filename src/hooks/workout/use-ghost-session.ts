import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcSuggestedWeight, calcSmartSuggestion, type OverloadSuggestion } from "@/lib/progressive-overload";

export type GhostSetData = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
};

export type GhostWorkoutData = {
  sessionDate: string;
  exercises: Record<string, GhostSetData[]>;
} | null;

/**
 * Per-exercise, per-set overload suggestion with intent metadata.
 * `weightKg` is always in kg; `intent` tells the UI whether it's an increase or maintain.
 */
export type SuggestionMap = Record<string, Record<number, OverloadSuggestion>>;

/**
 * Manages ghost workout loading: fetches the most recent completed session
 * for a given template and provides per-exercise ghost sets + suggested weights.
 *
 * `ghostIsLoading` must block "Start Workout" during fetch to avoid race conditions.
 */
export function useGhostSession(
  supabase: SupabaseClient,
  userId: string | null,
  selectedTemplateId: string,
  preference: "metric" | "imperial",
  /** Optional map of exerciseId -> muscleGroup for smarter increment sizing */
  exerciseMuscleGroups?: Record<string, string>,
) {
  const [ghostWorkoutData, setGhostWorkoutData] = useState<GhostWorkoutData>(null);
  const [ghostIsLoading, setGhostIsLoading] = useState(false);

  // Fetch ghost workout data when template is selected
  useEffect(() => {
    async function loadGhostWorkout() {
      if (selectedTemplateId === "none" || !userId) {
        setGhostWorkoutData(null);
        return;
      }

      setGhostIsLoading(true);
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

        // Fetch all sets from that session (now including rir)
        const { data: ghostSets, error: setsError } = await supabase
          .from("workout_sets")
          .select("exercise_id, set_number, reps, weight_kg, rir")
          .eq("session_id", ghostSession.id)
          .order("set_number", { ascending: true });

        if (setsError || !ghostSets) {
          setGhostWorkoutData(null);
          return;
        }

        // Group sets by exercise_id
        const exerciseMap: Record<string, GhostSetData[]> = {};
        for (const set of ghostSets) {
          if (!exerciseMap[set.exercise_id]) {
            exerciseMap[set.exercise_id] = [];
          }
          exerciseMap[set.exercise_id].push({
            setNumber: set.set_number,
            reps: set.reps,
            weight: set.weight_kg,
            rir: set.rir ?? null,
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
      } finally {
        setGhostIsLoading(false);
      }
    }

    void loadGhostWorkout();
  }, [selectedTemplateId, userId, supabase]);

  // Derived: suggested weights from ghost data -- always in kg; SetRow converts for display
  // Legacy flat map (exerciseId -> setIndex -> kg) for backward compat
  const suggestedWeightsByKey = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    if (!ghostWorkoutData) return map;
    for (const [exId, sets] of Object.entries(ghostWorkoutData.exercises)) {
      map[exId] = {};
      sets.forEach((s, idx) => {
        if (s.weight != null) {
          map[exId][idx] = calcSuggestedWeight(s.weight, preference);
        }
      });
    }
    return map;
  }, [ghostWorkoutData, preference]);

  // Smart suggestions with intent metadata (increase vs maintain)
  const smartSuggestions = useMemo<SuggestionMap>(() => {
    const map: SuggestionMap = {};
    if (!ghostWorkoutData) return map;
    for (const [exId, sets] of Object.entries(ghostWorkoutData.exercises)) {
      map[exId] = {};
      const muscleGroup = exerciseMuscleGroups?.[exId];
      sets.forEach((s, idx) => {
        if (s.weight != null) {
          map[exId][idx] = calcSmartSuggestion(
            { weightKg: s.weight, reps: s.reps, rir: s.rir },
            preference,
            muscleGroup,
          );
        }
      });
    }
    return map;
  }, [ghostWorkoutData, preference, exerciseMuscleGroups]);

  /**
   * Patch ghost data for a single exercise (used after swap).
   * Only re-fetches ghost data for the swapped-in exercise, not the whole session.
   */
  const patchGhostForExercise = useCallback(
    async (exerciseId: string) => {
      if (!userId || !ghostWorkoutData) return;

      const { data: ghostSets } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number, reps, weight_kg, rir, session_id")
        .eq("exercise_id", exerciseId)
        .order("set_number", { ascending: true });

      if (ghostSets && ghostSets.length > 0) {
        const patchSets: GhostSetData[] = ghostSets.map((s) => ({
          setNumber: s.set_number,
          reps: s.reps,
          weight: s.weight_kg,
          rir: s.rir ?? null,
        }));
        setGhostWorkoutData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            exercises: {
              ...prev.exercises,
              [exerciseId]: patchSets,
            },
          };
        });
      } else {
        // No ghost data for new exercise -- clear its entry
        setGhostWorkoutData((prev) => {
          if (!prev) return prev;
          const next = { ...prev, exercises: { ...prev.exercises } };
          delete next.exercises[exerciseId];
          return next;
        });
      }
    },
    [userId, ghostWorkoutData, supabase]
  );

  return {
    ghostWorkoutData,
    ghostIsLoading,
    suggestedWeightsByKey,
    smartSuggestions,
    patchGhostForExercise,
  };
}
