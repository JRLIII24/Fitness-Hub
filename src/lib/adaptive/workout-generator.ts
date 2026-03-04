/**
 * Adaptive Workout Generator
 * Generates workout recommendations based on fatigue analysis
 */

import { createClient } from '@/lib/supabase/server';
import { getCachedOrComputeFatigueSnapshot } from '@/lib/fatigue/server';
import { computeRecoveryStatus } from '@/lib/fatigue/muscle-group';
import { findSubstitute } from './find-substitute';
import { AUTO_SWAP_THRESHOLD } from './substitution-map';
import type { LauncherPrediction, LauncherExercise, ExerciseSwapResult, MuscleRecoverySnapshot } from '@/types/adaptive';

interface AdaptiveWorkout extends LauncherPrediction {
  fatigueScore: number;
  adaptationType: 'REST' | 'VOLUME' | 'INTENSITY';
  adaptationReason: string;
  volumeAdjustment: number; // Percentage change from baseline (-30 to +15)
  swaps?: ExerciseSwapResult[];
  muscleRecoverySnapshot?: MuscleRecoverySnapshot;
}

/**
 * Generate an adaptive workout based on fatigue analysis
 */
export async function generateAdaptiveWorkout(userId: string): Promise<AdaptiveWorkout> {
  const supabase = await createClient();

  // Analyze current fatigue state from shared fatigue engine.
  const snapshot = await getCachedOrComputeFatigueSnapshot(userId);
  const fatigueScore = snapshot.fatigueScore;

  // Dynamic volume adjustment using Acute:Chronic Ratio (ACR)
  // Based on Foster et al. — ACR > 1.5 is high injury risk zone
  const { avgLoad7d, avgLoad28d } = snapshot.metadata;
  let volumeAdjustment = 0;
  let recommendation: 'REST' | 'VOLUME' | 'INTENSITY' = 'VOLUME';

  if (avgLoad7d !== null && avgLoad28d !== null && avgLoad28d > 0) {
    const acr = avgLoad7d / avgLoad28d;
    if (acr > 1.5) {
      recommendation = 'REST';
      volumeAdjustment = -30;   // Very high injury risk — significantly reduce
    } else if (acr > 1.3) {
      recommendation = 'REST';
      volumeAdjustment = -20;   // High load zone — reduce
    } else if (acr > 1.1) {
      recommendation = 'VOLUME';
      volumeAdjustment = -5;    // Slightly elevated — minor reduction
    } else if (acr < 0.8) {
      recommendation = 'VOLUME';
      volumeAdjustment = 10;    // Underloaded — can push harder
    } else {
      recommendation = 'VOLUME';
      volumeAdjustment = 0;     // Optimal range (0.8–1.1)
    }
  } else {
    // Fallback to score-based when no load history available
    if (snapshot.fatigueScore > 70) {
      recommendation = 'REST';
      volumeAdjustment = -25;
    } else if (snapshot.fatigueScore > 50) {
      recommendation = 'VOLUME';
      volumeAdjustment = -10;
    } else {
      recommendation = 'VOLUME';
      volumeAdjustment = 0;
    }
  }

  const reason = snapshot.recommendation.guidance;

  // Get user's recent workout pattern (last completed workout or most common template)
  const { data: recentSessions } = await supabase
    .from('workout_sessions')
    .select('template_id, name')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(5);

  const sessions = recentSessions || [];

  // Find most common template from recent sessions
  const templateCounts = new Map<string, number>();
  sessions.forEach(s => {
    if (s.template_id) {
      templateCounts.set(s.template_id, (templateCounts.get(s.template_id) || 0) + 1);
    }
  });

  let baseTemplateId: string | null = null;
  if (templateCounts.size > 0) {
    const [mostCommonTemplateId] = Array.from(templateCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    baseTemplateId = mostCommonTemplateId;
  }

  // If we have a base template, adapt it
  if (baseTemplateId) {
    const { data: templateData } = await supabase
      .from('workout_templates')
      .select(`
        id,
        name,
        template_exercises (
          exercise_id,
          sort_order,
          exercises (id, name, muscle_group, equipment),
          template_exercise_sets (set_number, reps, weight_kg)
        )
      `)
      .eq('id', baseTemplateId)
      .single();

    if (templateData) {
      const exercises = adaptExercises(
        templateData.template_exercises as unknown as TemplateExerciseRow[],
        recommendation
      );

      const { exercises: swappedExercises, swaps, muscleRecoverySnapshot } =
        await applyMuscleSubstitutions(userId, exercises);

      return {
        template_id: baseTemplateId,
        template_name: getAdaptedName(templateData.name, recommendation),
        exercises: swappedExercises,
        estimated_duration_mins: estimateDuration(swappedExercises, recommendation),
        confidence: 'high',
        reason: `${reason} • Based on your recent ${templateData.name}`,
        fatigueScore,
        adaptationType: recommendation,
        adaptationReason: reason,
        volumeAdjustment,
        swaps: swaps.length > 0 ? swaps : undefined,
        muscleRecoverySnapshot,
      };
    }
  }

  // Fallback: Create a preset workout adapted to fatigue level
  const presetWorkout = await createPresetWorkout(recommendation);

  const { exercises: swappedExercises, swaps, muscleRecoverySnapshot } =
    await applyMuscleSubstitutions(userId, presetWorkout.exercises);

  return {
    ...presetWorkout,
    exercises: swappedExercises,
    fatigueScore,
    adaptationType: recommendation,
    adaptationReason: reason,
    volumeAdjustment,
    swaps: swaps.length > 0 ? swaps : undefined,
    muscleRecoverySnapshot,
  };
}

/**
 * Per-muscle substitution pass.
 * Checks each exercise's muscle group against the recovery map and swaps
 * or deloads exercises targeting fatigued muscles.
 */
async function applyMuscleSubstitutions(
  userId: string,
  exercises: LauncherExercise[]
): Promise<{
  exercises: LauncherExercise[];
  swaps: ExerciseSwapResult[];
  muscleRecoverySnapshot: MuscleRecoverySnapshot;
}> {
  const supabase = await createClient();

  // Fetch per-muscle recovery data via RPC
  const { data: recoveryRows } = await supabase.rpc('get_muscle_group_recovery', {
    p_user_id: userId,
    p_lookback_days: 7,
  });

  // Build recovery map from RPC results
  const recoveryMap: Record<string, { status: string; recoveryPct: number }> = {};
  const muscleRecoverySnapshot: MuscleRecoverySnapshot = {};

  if (recoveryRows && Array.isArray(recoveryRows)) {
    for (const row of recoveryRows) {
      const { status, pct } = computeRecoveryStatus(
        row.hours_since_trained,
        row.total_sets,
        row.avg_rpe ?? null
      );
      recoveryMap[row.muscle_group] = { status, recoveryPct: pct };
      muscleRecoverySnapshot[row.muscle_group] = {
        status,
        recoveryPct: pct,
        hoursSinceTrained: row.hours_since_trained,
        totalSets: row.total_sets,
      };
    }
  }

  const swaps: ExerciseSwapResult[] = [];
  const result: LauncherExercise[] = [];

  for (const ex of exercises) {
    const { swap, deload } = await findSubstitute(
      ex.exercise.id,
      ex.exercise.name,
      ex.exercise.muscle_group,
      ex.exercise.equipment,
      recoveryMap
    );

    if (swap) {
      // Replace exercise with the swapped one
      result.push({
        ...ex,
        exercise: {
          id: swap.swappedExerciseId,
          name: swap.swappedExerciseName,
          muscle_group: swap.swappedMuscleGroup,
          equipment: ex.exercise.equipment,
        },
      });
      swaps.push(swap);
    } else if (deload) {
      // Keep same exercise but reduce load
      result.push({
        ...ex,
        target_sets: Math.max(1, Math.round(ex.target_sets * deload.setsMultiplier)),
        target_weight_kg: ex.target_weight_kg
          ? Math.round(ex.target_weight_kg * deload.weightMultiplier * 10) / 10
          : null,
      });
    } else {
      result.push(ex);
    }
  }

  return { exercises: result, swaps, muscleRecoverySnapshot };
}

/**
 * Adapt exercises based on recommendation type
 */
interface TemplateExerciseRow {
  exercises:
  | {
    id: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
  }
  | Array<{
    id: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
  }>
  | null;
  template_exercise_sets?: Array<{
    set_number?: number | null;
    reps?: number | null;
    weight_kg?: number | null;
  }>;
}

function adaptExercises(
  templateExercises: TemplateExerciseRow[],
  recommendation: 'REST' | 'VOLUME' | 'INTENSITY'
): LauncherExercise[] {
  return templateExercises.flatMap((te) => {
    const exercise = Array.isArray(te.exercises) ? te.exercises[0] : te.exercises;
    if (!exercise) return [];
    const baseSets = te.template_exercise_sets || [];
    const firstSet = baseSets[0] || { reps: 10, weight_kg: null };

    let targetSets = baseSets.length || 3;
    let targetReps = firstSet.reps || 10;
    let targetWeight = firstSet.weight_kg;

    // Apply adaptations
    if (recommendation === 'REST') {
      // Deload: reduce sets and/or weight
      targetSets = Math.max(2, Math.floor(targetSets * 0.7)); // -30% sets
      if (targetWeight) {
        targetWeight = Math.round(targetWeight * 0.7 * 10) / 10; // -30% weight
      }
    } else if (recommendation === 'INTENSITY') {
      // Push: add a set or increase reps
      targetSets = Math.min(6, targetSets + 1); // +1 set (capped at 6)
      // OR increase reps by 1-2
      if (targetReps < 12) {
        targetReps += 1;
      }
    }
    // VOLUME = no change

    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        muscle_group: exercise.muscle_group,
        equipment: exercise.equipment
      },
      target_sets: targetSets,
      target_reps: targetReps,
      target_weight_kg: targetWeight ?? null
    };
  });
}

/**
 * Create a preset workout when no template history exists
 */
async function createPresetWorkout(
  recommendation: 'REST' | 'VOLUME' | 'INTENSITY'
): Promise<LauncherPrediction> {
  const supabase = await createClient();

  // For REST, focus on lighter movements
  const muscleGroups = recommendation === 'REST'
    ? ['core', 'back'] // Lower intensity
    : ['chest', 'back', 'legs']; // Full body

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .in('muscle_group', muscleGroups)
    .eq('category', 'compound')
    .limit(recommendation === 'REST' ? 3 : 5);

  const targetSets = recommendation === 'REST' ? 2 : recommendation === 'INTENSITY' ? 4 : 3;
  const targetReps = recommendation === 'REST' ? 12 : 10;

  const launcherExercises: LauncherExercise[] = (exercises || []).map(ex => ({
    exercise: ex,
    target_sets: targetSets,
    target_reps: targetReps,
    target_weight_kg: null
  }));

  return {
    template_id: null,
    template_name: getAdaptedName('Full Body Workout', recommendation),
    exercises: launcherExercises,
    estimated_duration_mins: estimateDuration(launcherExercises, recommendation),
    confidence: 'medium',
    reason: `Adaptive ${recommendation.toLowerCase()} workout based on fatigue analysis`
  };
}

/**
 * Get adapted workout name with prefix
 */
function getAdaptedName(baseName: string, recommendation: 'REST' | 'VOLUME' | 'INTENSITY'): string {
  const prefix = recommendation === 'REST' ? 'Recovery' : recommendation === 'INTENSITY' ? 'Intensity' : 'Balanced';
  return `${prefix} ${baseName}`;
}

/**
 * Estimate workout duration based on exercise count and type
 */
function estimateDuration(exercises: LauncherExercise[], recommendation: 'REST' | 'VOLUME' | 'INTENSITY'): number {
  const baseMinutesPerExercise = 8;
  const count = exercises.length;

  if (recommendation === 'REST') {
    return Math.round(count * baseMinutesPerExercise * 0.7); // Shorter rest periods
  } else if (recommendation === 'INTENSITY') {
    return Math.round(count * baseMinutesPerExercise * 1.2); // Longer rest periods
  }

  return count * baseMinutesPerExercise;
}
