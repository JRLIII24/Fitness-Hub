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
