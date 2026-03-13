import type { PlanExercise } from "@/types/workout";

/**
 * Estimate total workout duration in minutes from plan exercises.
 *
 * Per set: working time (reps-dependent) + rest between sets.
 * Transition time (~60 s) added between exercises.
 */
export function estimateWorkoutDuration(exercises: PlanExercise[]): number {
  let totalSeconds = 0;

  for (const ex of exercises) {
    const sets = ex.targetSets;
    const reps = ex.targetReps ?? 10;

    // Heavier / lower-rep sets take longer
    const secondsPerSet = reps <= 5 ? 60 : reps <= 10 ? 45 : 30;
    const rest = ex.restSeconds ?? 90;

    totalSeconds += sets * secondsPerSet + Math.max(0, sets - 1) * rest;
  }

  // ~60 s transition between exercises
  totalSeconds += Math.max(0, exercises.length - 1) * 60;

  return Math.round(totalSeconds / 60);
}
