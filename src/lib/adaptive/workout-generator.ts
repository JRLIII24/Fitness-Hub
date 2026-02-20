/**
 * Adaptive Workout Generator
 * Generates workout recommendations based on fatigue analysis
 */

import { createClient } from '@/lib/supabase/server';
import { analyzeFatigue } from './fatigue';
import type { LauncherPrediction, LauncherExercise } from '@/types/adaptive';

interface AdaptiveWorkout extends LauncherPrediction {
  fatigueScore: number;
  adaptationType: 'REST' | 'VOLUME' | 'INTENSITY';
  adaptationReason: string;
  volumeAdjustment: number; // Percentage change from baseline (-30 to +15)
}

/**
 * Generate an adaptive workout based on fatigue analysis
 */
export async function generateAdaptiveWorkout(userId: string): Promise<AdaptiveWorkout> {
  const supabase = await createClient();

  // Analyze current fatigue state
  const fatigueAnalysis = await analyzeFatigue(userId);
  const { fatigueScore, recommendation, reason } = fatigueAnalysis;

  // Determine volume adjustment
  let volumeAdjustment = 0;
  if (recommendation === 'REST') {
    volumeAdjustment = -30; // Deload: 30% less volume
  } else if (recommendation === 'INTENSITY') {
    volumeAdjustment = 15; // Push: 15% more volume
  }
  // VOLUME recommendation = 0% adjustment (normal)

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
        templateData.template_exercises as any[],
        recommendation,
        volumeAdjustment
      );

      return {
        template_id: baseTemplateId,
        template_name: getAdaptedName(templateData.name, recommendation),
        exercises,
        estimated_duration_mins: estimateDuration(exercises, recommendation),
        confidence: 'high',
        reason: `${reason} • Based on your recent ${templateData.name}`,
        fatigueScore,
        adaptationType: recommendation,
        adaptationReason: reason,
        volumeAdjustment
      };
    }
  }

  // Fallback: Create a preset workout adapted to fatigue level
  const presetWorkout = await createPresetWorkout(recommendation, volumeAdjustment);

  return {
    ...presetWorkout,
    fatigueScore,
    adaptationType: recommendation,
    adaptationReason: reason,
    volumeAdjustment
  };
}

/**
 * Adapt exercises based on recommendation type
 */
function adaptExercises(
  templateExercises: any[],
  recommendation: 'REST' | 'VOLUME' | 'INTENSITY',
  volumeAdjustment: number
): LauncherExercise[] {
  return templateExercises.map((te: any) => {
    const exercise = te.exercises;
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
      target_weight_kg: targetWeight
    };
  });
}

/**
 * Create a preset workout when no template history exists
 */
async function createPresetWorkout(
  recommendation: 'REST' | 'VOLUME' | 'INTENSITY',
  volumeAdjustment: number
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
  const prefix = recommendation === 'REST' ? '🔋 Recovery' : recommendation === 'INTENSITY' ? '💪 Intensity' : '⚖️';
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
