/**
 * Estimated One-Rep Max (e1RM) Calculators
 *
 * Brzycki formula: weight × (36 / (37 - reps))
 * Valid for 1-12 reps; returns raw weight for 1 rep.
 */

/**
 * Calculate estimated 1RM using Brzycki formula.
 * Returns null if reps < 1 or > 12 (formula unreliable beyond 12 reps).
 */
export function estimateE1RM(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12 || weightKg <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (36 / (37 - reps));
}
