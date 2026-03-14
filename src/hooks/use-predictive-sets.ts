"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutExercise } from "@/types/workout";
import {
  calcSmartSuggestion,
  type GhostSetContext,
  type OverloadSuggestion,
} from "@/lib/progressive-overload";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

export type PredictiveEntry = OverloadSuggestion & { reps: number | null };
export type PredictiveMap = Map<string, PredictiveEntry>;

/**
 * Fetches last-session performance for each exercise via the
 * `get_exercise_last_performance` RPC and runs `calcSmartSuggestion`
 * to produce a predictive weight/reps map keyed by `${exerciseId}:${setIndex}`.
 */
export function usePredictiveSets(
  exercises: WorkoutExercise[],
  userId: string | null
): PredictiveMap {
  const [predictions, setPredictions] = useState<PredictiveMap>(
    () => new Map()
  );
  const { preference } = useUnitPreferenceStore();
  const supabase = useMemo(() => createClient(), []);

  // Build a stable key from exercise IDs so we only refetch when exercises change
  const exerciseIds = useMemo(
    () =>
      exercises
        .map((e) => e.exercise.id)
        .filter((id) => !id.startsWith("custom-")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(exercises.map((e) => e.exercise.id))]
  );

  // Build exerciseId -> muscleGroup map
  const muscleGroups = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ex of exercises) {
      map[ex.exercise.id] = ex.exercise.muscle_group;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(exercises.map((e) => e.exercise.id))]);

  // Build exerciseId -> setCount map for per-set predictions
  const setCountByExercise = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      map[ex.exercise.id] = ex.sets.length;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(exercises.map((e) => `${e.exercise.id}:${e.sets.length}`))]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!userId || exerciseIds.length === 0) {
      setPredictions(new Map());
      return;
    }

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchPredictions() {
      // The RPC may not be in generated DB types yet (migration 084),
      // so we cast to `any` to avoid TS errors until types are regenerated.
      const { data, error } = await (supabase.rpc as any)(
        "get_exercise_last_performance",
        {
          p_user_id: userId!,
          p_exercise_ids: exerciseIds,
        }
      );

      if (controller.signal.aborted) return;

      if (error || !data) {
        console.error("Predictive overload RPC error:", error);
        return;
      }

      type PerfRow = {
        exercise_id: string;
        weight_kg: number;
        reps: number;
        rir: number | null;
        rpe: number | null;
        session_date: string;
        set_count: number;
      };

      const map: PredictiveMap = new Map();

      for (const row of data as PerfRow[]) {
        const ghost: GhostSetContext = {
          weightKg: Number(row.weight_kg),
          reps: row.reps,
          rir: row.rir,
        };

        const suggestion = calcSmartSuggestion(
          ghost,
          preference,
          muscleGroups[row.exercise_id]
        );

        // Apply the same prediction to every set of this exercise
        const setCount = setCountByExercise[row.exercise_id] ?? row.set_count;
        for (let i = 0; i < setCount; i++) {
          map.set(`${row.exercise_id}:${i}`, {
            ...suggestion,
            reps: row.reps,
          });
        }
      }

      if (!controller.signal.aborted) {
        setPredictions(map);
      }
    }

    void fetchPredictions();

    return () => {
      controller.abort();
    };
  }, [userId, exerciseIds, preference, muscleGroups, setCountByExercise, supabase]);

  return predictions;
}
