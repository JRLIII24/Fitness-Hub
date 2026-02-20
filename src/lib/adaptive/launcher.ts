/**
 * Smart Workout Launcher - Prediction Logic
 * Predicts user's intended workout based on patterns
 */

import { createClient } from '@/lib/supabase/server';
import type { LauncherPrediction, LauncherExercise, WorkoutFocus } from '@/types/adaptive';

interface WorkoutHistory {
  id: string;
  template_id: string | null;
  started_at: string;
  duration_mins: number;
  day_of_week: number;
}

/**
 * Compute "usual workout" for today based on user patterns
 */
export async function computeLauncherWorkout(userId: string): Promise<LauncherPrediction> {
  const supabase = await createClient();
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0-6

  // Fetch last 30 days of workout history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: history, error } = await supabase
    .from('workout_sessions')
    .select('id, template_id, started_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', thirtyDaysAgo)
    .order('started_at', { ascending: false });

  if (error || !history || history.length === 0) {
    // No history: return preset template
    return getPresetWorkout('full_body_compound');
  }

  // Process history
  const workoutHistory: WorkoutHistory[] = history.map(w => ({
    id: w.id,
    template_id: w.template_id,
    started_at: w.started_at,
    duration_mins: 45, // TODO: Calculate from sets
    day_of_week: new Date(w.started_at).getDay()
  }));

  // Strategy 1: Find most common template for this day of week
  const todayWorkouts = workoutHistory.filter(w => w.day_of_week === dayOfWeek);

  if (todayWorkouts.length >= 2) {
    const templateCounts = countTemplates(todayWorkouts);
    const mostCommon = getMostCommonTemplate(templateCounts);

    if (mostCommon && mostCommon.count >= 2) {
      // High confidence: user has pattern for this day
      const exercises = await getTemplateExercises(mostCommon.template_id);
      const avgDuration = calculateAvgDuration(todayWorkouts);

      return {
        template_id: mostCommon.template_id,
        template_name: await getTemplateName(mostCommon.template_id),
        exercises,
        estimated_duration_mins: avgDuration,
        confidence: 'high',
        reason: `You usually do this on ${getDayName(dayOfWeek)}s`
      };
    }
  }

  // Strategy 2: Most recent template (any day)
  const recentWithTemplate = workoutHistory.find(w => w.template_id);
  if (recentWithTemplate) {
    const exercises = await getTemplateExercises(recentWithTemplate.template_id!);

    return {
      template_id: recentWithTemplate.template_id,
      template_name: await getTemplateName(recentWithTemplate.template_id!),
      exercises,
      estimated_duration_mins: recentWithTemplate.duration_mins,
      confidence: 'medium',
      reason: 'Your most recent workout'
    };
  }

  // Strategy 3: Fallback to preset
  return getPresetWorkout('full_body_compound');
}

/**
 * Get template exercises with last performance data
 */
async function getTemplateExercises(templateId: string): Promise<LauncherExercise[]> {
  const supabase = await createClient();

  const { data: templateExercises } = await supabase
    .from('template_exercises')
    .select(`
      exercise_id,
      sort_order,
      exercises (id, name, muscle_group, equipment),
      template_exercise_sets (set_number, reps, weight_kg)
    `)
    .eq('template_id', templateId)
    .order('sort_order');

  if (!templateExercises) return [];

  return templateExercises.map((te: any) => ({
    exercise: {
      id: te.exercises.id,
      name: te.exercises.name,
      muscle_group: te.exercises.muscle_group,
      equipment: te.exercises.equipment
    },
    target_sets: te.template_exercise_sets?.length || 3,
    target_reps: te.template_exercise_sets?.[0]?.reps || 10,
    target_weight_kg: te.template_exercise_sets?.[0]?.weight_kg || null
  }));
}

/**
 * Get template name
 */
async function getTemplateName(templateId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workout_templates')
    .select('name')
    .eq('id', templateId)
    .single();

  return data?.name || 'Workout';
}

/**
 * Get preset workout (for new users)
 */
async function getPresetWorkout(preset: string): Promise<LauncherPrediction> {
  const supabase = await createClient();

  // Get common exercises for full body compound
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .eq('category', 'compound')
    .in('muscle_group', ['chest', 'back', 'legs'])
    .limit(5);

  const launcherExercises: LauncherExercise[] = (exercises || []).map(ex => ({
    exercise: ex,
    target_sets: 3,
    target_reps: 10,
    target_weight_kg: null
  }));

  return {
    template_id: null,
    template_name: 'Full Body Workout',
    exercises: launcherExercises,
    estimated_duration_mins: 45,
    confidence: 'low',
    reason: 'Recommended for you'
  };
}

/**
 * Helper: Count template occurrences
 */
function countTemplates(workouts: WorkoutHistory[]): Record<string, number> {
  const counts: Record<string, number> = {};

  workouts.forEach(w => {
    if (w.template_id) {
      counts[w.template_id] = (counts[w.template_id] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Helper: Get most common template
 */
function getMostCommonTemplate(counts: Record<string, number>): { template_id: string; count: number } | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  const [template_id, count] = entries.reduce((max, entry) =>
    entry[1] > max[1] ? entry : max
  );

  return { template_id, count };
}

/**
 * Helper: Calculate average duration
 */
function calculateAvgDuration(workouts: WorkoutHistory[]): number {
  if (workouts.length === 0) return 45;

  const sum = workouts.reduce((acc, w) => acc + w.duration_mins, 0);
  return Math.round(sum / workouts.length);
}

/**
 * Helper: Get day name
 */
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Get alternative templates (for quick swap)
 */
export async function getAlternativeTemplates(userId: string, limit: number = 3) {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('workout_templates')
    .select(`
      id,
      name,
      updated_at,
      template_exercises (id)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  return (templates || []).map(t => ({
    id: t.id,
    name: t.name,
    exercise_count: Array.isArray(t.template_exercises) ? t.template_exercises.length : 0,
    last_used: t.updated_at
  }));
}

/**
 * Log launcher event
 */
export async function logLauncherEvent(
  userId: string,
  eventType: 'launcher_shown' | 'launcher_accepted' | 'launcher_rejected',
  properties: Record<string, any>
) {
  const supabase = await createClient();

  await supabase.from('workout_events').insert({
    user_id: userId,
    event_type: 'workout_launched',
    event_data: {
      action: eventType,
      ...properties
    }
  });
}
