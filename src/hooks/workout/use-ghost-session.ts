import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Manages ghost workout loading: fetches the most recent completed session
 * for a given template and provides per-exercise ghost sets.
 *
 * `ghostIsLoading` must block "Start Workout" during fetch to avoid race conditions.
 */
export function useGhostSession(
  supabase: SupabaseClient,
  userId: string | null,
  selectedTemplateId: string,
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
          .not("weight_kg", "is", null)
          .not("reps", "is", null)
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

  /**
   * Patch ghost data for a single exercise (used after swap).
   * Only re-fetches ghost data for the swapped-in exercise, not the whole session.
   */
  const patchGhostForExercise = useCallback(
    async (exerciseId: string) => {
      if (!userId || !ghostWorkoutData) return;

      type SessionLink = { completed_at: string | null } | Array<{ completed_at: string | null }> | null;
      type GhostRow = {
        session_id: string;
        set_number: number;
        reps: number | null;
        weight_kg: number | null;
        rir: number | null;
        workout_sessions: SessionLink;
      };

      const { data: ghostRows, error: ghostRowsError } = await supabase
        .from("workout_sets")
        .select("session_id, set_number, reps, weight_kg, rir, workout_sessions!inner(user_id,status,completed_at)")
        .eq("exercise_id", exerciseId)
        .eq("workout_sessions.user_id", userId)
        .eq("workout_sessions.status", "completed")
        .not("workout_sessions.completed_at", "is", null)
        .not("completed_at", "is", null);

      if (ghostRowsError || !ghostRows || ghostRows.length === 0) {
        // No ghost data for new exercise -- clear its entry
        setGhostWorkoutData((prev) => {
          if (!prev) return prev;
          const next = { ...prev, exercises: { ...prev.exercises } };
          delete next.exercises[exerciseId];
          return next;
        });
        return;
      }

      const normalizedRows = (ghostRows as GhostRow[])
        .map((row) => {
          const session = Array.isArray(row.workout_sessions)
            ? row.workout_sessions[0]
            : row.workout_sessions;
          return {
            session_id: row.session_id,
            set_number: row.set_number,
            reps: row.reps,
            weight_kg: row.weight_kg,
            rir: row.rir ?? null,
            completed_at: session?.completed_at ?? null,
          };
        })
        .filter((row) => row.completed_at != null)
        .sort((a, b) => {
          const completedDiff =
            new Date(b.completed_at ?? 0).getTime() -
            new Date(a.completed_at ?? 0).getTime();
          if (completedDiff !== 0) return completedDiff;
          const sessionDiff = String(b.session_id).localeCompare(String(a.session_id));
          if (sessionDiff !== 0) return sessionDiff;
          return a.set_number - b.set_number;
        });

      if (normalizedRows.length === 0) {
        setGhostWorkoutData((prev) => {
          if (!prev) return prev;
          const next = { ...prev, exercises: { ...prev.exercises } };
          delete next.exercises[exerciseId];
          return next;
        });
        return;
      }

      const latestSessionId = normalizedRows[0].session_id;
      const patchSets: GhostSetData[] = normalizedRows
        .filter((row) => row.session_id === latestSessionId)
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
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
    },
    [userId, ghostWorkoutData, supabase]
  );

  return {
    ghostWorkoutData,
    ghostIsLoading,
    patchGhostForExercise,
  };
}
