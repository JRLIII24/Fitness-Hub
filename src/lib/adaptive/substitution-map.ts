/**
 * Static substitution rules for auto-regulatory exercise swaps.
 * When a muscle group is too fatigued, we swap to an alternative group.
 */

/** Recovery percentage below which a swap is triggered */
export const AUTO_SWAP_THRESHOLD = 40;

/** Target muscle must be above this to be considered a safe alternative */
export const SAFE_RECOVERY_THRESHOLD = 60;

/**
 * Maps each muscle group to ordered alternatives for substitution.
 * Alternatives are listed in priority order (most similar movement pattern first).
 */
export const SUBSTITUTION_MAP: Record<string, string[]> = {
  chest: ['shoulders', 'triceps'],
  back: ['shoulders', 'biceps'],
  legs: ['core', 'glutes'],
  hamstrings: ['glutes', 'calves'],
  shoulders: ['chest', 'arms'],
  quadriceps: ['glutes', 'calves'],
  biceps: ['forearms', 'back'],
  triceps: ['shoulders', 'chest'],
  glutes: ['hamstrings', 'core'],
  calves: ['glutes', 'quadriceps'],
  core: ['back', 'shoulders'],
  forearms: ['biceps', 'triceps'],
  arms: ['shoulders', 'core'],
};

/**
 * Maps heavy barbell compounds to machine/cable equivalents for CNS bypass.
 * When systemic fatigue is high but the target muscle is locally recovered,
 * swap to the machine variant to reduce CNS demand while preserving volume.
 */
export const BARBELL_TO_MACHINE_MAP: Record<string, string> = {
  "Barbell Squat": "Leg Press",
  "Back Squat": "Leg Press",
  "Front Squat": "Hack Squat",
  "Barbell Deadlift": "Leg Press",
  "Romanian Deadlift": "Lying Leg Curl",
  "Barbell Bench Press": "Machine Chest Press",
  "Incline Barbell Press": "Incline Dumbbell Press",
  "Barbell Row": "Cable Row",
  "Bent-Over Row": "Cable Row",
  "Barbell Overhead Press": "Dumbbell Shoulder Press",
  "Barbell Curl": "Cable Curl",
  "Barbell Skullcrusher": "Cable Tricep Pushdown",
};

/** Systemic score below which CNS bypass is triggered */
export const CNS_BYPASS_SYSTEMIC_THRESHOLD = 40;

/** Local muscle recovery must be above this for CNS bypass (muscle is ready, CNS is not) */
export const CNS_BYPASS_LOCAL_RECOVERY_THRESHOLD = 80;
