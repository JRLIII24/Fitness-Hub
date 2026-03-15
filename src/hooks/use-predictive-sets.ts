"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutExercise } from "@/types/workout";
import {
  calcSmartSuggestion,
  type GhostSetContext,
  type OverloadSuggestion,
} from "@/lib/progressive-overload";
import { createClient } from "@/lib/supabase/client";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

export type PredictiveEntry = OverloadSuggestion & {
  reps: number | null;
  /** Raw previous weight in kg (before overload calculation) */
  previousWeightKg: number;
  /** Raw previous reps */
  previousReps: number | null;
};
export type PredictiveMap = Map<string, PredictiveEntry>;

type PerSetPerformanceRow = {
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  session_date?: string;
};

/**
 * Fetches last-session performance for each exercise and runs `calcSmartSuggestion`
 * to produce a predictive weight/reps map keyed by `${exerciseId}:${setIndex}`.
 *
 * Each entry includes both the overload suggestion AND the raw previous values,
 * so the UI can show ghost "Previous" data for any exercise with history.
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

  const buildPerSetPredictionMap = useCallback(
    (rows: PerSetPerformanceRow[]): PredictiveMap => {
      const map: PredictiveMap = new Map();
      const byExercise = new Map<string, PerSetPerformanceRow[]>();

      for (const row of rows) {
        const existing = byExercise.get(row.exercise_id) ?? [];
        existing.push(row);
        byExercise.set(row.exercise_id, existing);
      }

      for (const [exerciseId, exerciseRows] of byExercise) {
        const rowsBySet = exerciseRows
          .slice()
          .sort((a, b) => a.set_number - b.set_number);
        const currentSetCount = setCountByExercise[exerciseId] ?? rowsBySet.length;
        const muscleGroup = muscleGroups[exerciseId];

        for (let i = 0; i < currentSetCount; i++) {
          const row = rowsBySet[Math.min(i, rowsBySet.length - 1)];
          if (!row) continue;

          const prevWeight = Number(row.weight_kg);
          const prevReps = row.reps;
          const ghost: GhostSetContext = {
            weightKg: prevWeight,
            reps: prevReps,
            rir: row.rir,
          };
          const suggestion = calcSmartSuggestion(ghost, preference, muscleGroup);

          map.set(`${exerciseId}:${i}`, {
            ...suggestion,
            reps: prevReps,
            previousWeightKg: prevWeight,
            previousReps: prevReps,
          });
        }
      }

      return map;
    },
    [muscleGroups, preference, setCountByExercise]
  );

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
      // Try per-set RPC first (migration 087). If unavailable, fall back to
      // a direct table query that preserves per-set granularity.
      const perSetResult = await (supabase.rpc as any)(
        "get_exercise_last_performance_per_set",
        { p_user_id: userId!, p_exercise_ids: exerciseIds }
      );

      if (controller.signal.aborted) return;

      const hasPerSetRpcData =
        !perSetResult.error && Array.isArray(perSetResult.data);
      let perSetRows: PerSetPerformanceRow[] | null = hasPerSetRpcData
        ? (perSetResult.data as PerSetPerformanceRow[])
        : null;

      if (!hasPerSetRpcData) {
        console.warn(
          "[usePredictiveSets] Per-set RPC unavailable, falling back to direct query.",
          perSetResult.error?.message
        );
        type DirectPerfRow = {
          exercise_id: string;
          set_number: number | null;
          reps: number | null;
          weight_kg: number | null;
          rir: number | null;
          rpe: number | null;
          session_id: string;
          workout_sessions:
            | { completed_at: string | null }
            | { completed_at: string | null }[]
            | null;
        };

        const { data: directRows, error: directError } = await supabase
          .from("workout_sets")
          .select(
            "exercise_id,set_number,reps,weight_kg,rir,rpe,session_id,workout_sessions!inner(user_id,status,completed_at)"
          )
          .eq("workout_sessions.user_id", userId!)
          .eq("workout_sessions.status", "completed")
          .not("workout_sessions.completed_at", "is", null)
          .not("completed_at", "is", null)
          .in("exercise_id", exerciseIds)
          .limit(500);

        if (controller.signal.aborted) return;

        if (!directError && Array.isArray(directRows)) {
          const rows = (directRows as DirectPerfRow[])
            .map((row) => {
              const session = Array.isArray(row.workout_sessions)
                ? row.workout_sessions[0]
                : row.workout_sessions;

              return {
                exercise_id: row.exercise_id,
                set_number: row.set_number,
                reps: row.reps,
                weight_kg: row.weight_kg,
                rir: row.rir,
                rpe: row.rpe,
                completed_at: session?.completed_at ?? null,
                session_id: row.session_id,
              };
            })
            .filter(
              (row): row is {
                exercise_id: string;
                set_number: number;
                reps: number;
                weight_kg: number;
                rir: number | null;
                rpe: number | null;
                completed_at: string;
                session_id: string;
              } =>
                row.completed_at != null &&
                row.set_number != null &&
                row.reps != null &&
                row.weight_kg != null
            )
            .sort((a, b) => {
              const completedDiff =
                new Date(b.completed_at).getTime() -
                new Date(a.completed_at).getTime();
              if (completedDiff !== 0) return completedDiff;

              const sessionDiff = String(b.session_id).localeCompare(
                String(a.session_id)
              );
              if (sessionDiff !== 0) return sessionDiff;

              return a.set_number - b.set_number;
            });

          const latestSessionByExercise = new Map<string, string>();
          for (const row of rows) {
            if (!latestSessionByExercise.has(row.exercise_id)) {
              latestSessionByExercise.set(row.exercise_id, row.session_id);
            }
          }

          perSetRows = rows
            .filter(
              (row) =>
                latestSessionByExercise.get(row.exercise_id) === row.session_id
            )
            .map((row) => ({
              exercise_id: row.exercise_id,
              set_number: row.set_number,
              reps: row.reps,
              weight_kg: row.weight_kg,
              rir: row.rir,
              rpe: row.rpe,
            }));
        }
      }

      if (perSetRows) {
        if (!controller.signal.aborted) {
          setPredictions(buildPerSetPredictionMap(perSetRows));
        }
        return;
      }

      // Legacy single-row RPC cannot provide per-set data — return empty
      // rather than showing identical values for every set.
      console.warn(
        "[usePredictiveSets] Both per-set RPC and direct query failed. " +
          "No per-set predictions available.",
        { perSetError: perSetResult.error }
      );
    }

    void fetchPredictions();

    return () => {
      controller.abort();
    };
  }, [
    userId,
    exerciseIds,
    preference,
    muscleGroups,
    setCountByExercise,
    supabase,
    buildPerSetPredictionMap,
  ]);

  return predictions;
}
