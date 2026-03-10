/**
 * Auto-regulatory exercise substitution engine.
 * Finds safe alternative exercises when a muscle group is too fatigued,
 * or applies a deload if no safe substitute is available.
 */

import { createClient } from '@/lib/supabase/server';
import { SUBSTITUTION_MAP, AUTO_SWAP_THRESHOLD, SAFE_RECOVERY_THRESHOLD } from './substitution-map';

export interface ExerciseSwapResult {
  originalExerciseId: string;
  originalExerciseName: string;
  originalMuscleGroup: string;
  swappedExerciseId: string;
  swappedExerciseName: string;
  swappedMuscleGroup: string;
  reason: string;
  fatigueStatus: { recoveryPct: number; status: string };
}

export interface DeloadResult {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  weightMultiplier: number; // 0.5
  setsMultiplier: number;   // 0.6
  reason: string;
}

type MuscleRecoveryMap = Record<string, { status: string; recoveryPct: number }>;

/**
 * Determine whether an exercise needs substitution or deloading based on
 * the muscle group's current recovery state.
 *
 * Returns a swap if a safe alternative muscle group has available exercises,
 * a deload if no substitute is found, or neither if the muscle is recovered.
 */
export async function findSubstitute(
  exerciseId: string,
  exerciseName: string,
  muscleGroup: string,
  equipment: string | null,
  recoveryMap: MuscleRecoveryMap
): Promise<{ swap: ExerciseSwapResult | null; deload: DeloadResult | null }> {
  const muscleRecovery = recoveryMap[muscleGroup];

  // No swap needed if muscle is recovered enough
  if (!muscleRecovery || muscleRecovery.recoveryPct >= AUTO_SWAP_THRESHOLD) {
    return { swap: null, deload: null };
  }

  // Try to find substitute from alternative muscle groups
  const alternatives = SUBSTITUTION_MAP[muscleGroup] || [];
  const safeAlternatives = alternatives.filter(alt => {
    const altRecovery = recoveryMap[alt];
    return !altRecovery || altRecovery.recoveryPct >= SAFE_RECOVERY_THRESHOLD;
  });

  if (safeAlternatives.length > 0) {
    // Query exercises table for alternatives matching equipment preference
    const supabase = await createClient();

    let query = supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment')
      .in('muscle_group', safeAlternatives as any)
      .eq('is_custom', false)
      .limit(5);

    if (equipment) {
      query = query.eq('equipment', equipment as any);
    }

    const { data: candidates } = await query;

    if (candidates && candidates.length > 0) {
      const picked = candidates[0];
      return {
        swap: {
          originalExerciseId: exerciseId,
          originalExerciseName: exerciseName,
          originalMuscleGroup: muscleGroup,
          swappedExerciseId: picked.id,
          swappedExerciseName: picked.name,
          swappedMuscleGroup: picked.muscle_group,
          reason: `${muscleGroup} fatigued (${muscleRecovery.recoveryPct}% recovered) — swapped to ${picked.muscle_group}`,
          fatigueStatus: muscleRecovery,
        },
        deload: null,
      };
    }
  }

  // No substitute available — apply deload
  return {
    swap: null,
    deload: {
      exerciseId,
      exerciseName,
      muscleGroup,
      weightMultiplier: 0.5,
      setsMultiplier: 0.6,
      reason: `${muscleGroup} fatigued (${muscleRecovery.recoveryPct}% recovered) — no safe substitute, deloading`,
    },
  };
}
