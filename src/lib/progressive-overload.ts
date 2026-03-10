import { KG_TO_LBS } from "@/lib/units";

// Lower-body muscle groups get larger increments
const LOWER_BODY_GROUPS = new Set(["legs", "glutes", "quads", "hamstrings", "calves"]);

/**
 * Returns a suggested weight in **kg**, bumped by the standard plate increment
 * for the user's unit preference and snapped to the nearest available plate size.
 *
 * Always operates in true kg so the store stays metric. `SetRow` converts the
 * result to the user's preferred display unit for rendering.
 *
 * The result is display-only and should never be written to the store directly
 * by the caller; the autofill path in page.tsx writes it as `weight_kg`.
 */
export function calcSuggestedWeight(
  ghostKg: number,
  preference: "imperial" | "metric"
): number {
  if (preference === "imperial") {
    // Work in lbs, snap to nearest 2.5 lb plate
    const ghostLbs = ghostKg * KG_TO_LBS;
    const bump = ghostLbs < 100 ? 2.5 : 5;
    const snappedLbs = Math.round((ghostLbs + bump) / 2.5) * 2.5;
    return snappedLbs / KG_TO_LBS;
  }
  // metric: snap to nearest 1.25 kg (smallest standard plate pair)
  const bump = ghostKg < 50 ? 1.25 : 2.5;
  return Math.round((ghostKg + bump) / 1.25) * 1.25;
}

/**
 * Context from the ghost (previous) set used to decide whether to suggest
 * a weight increase, maintain, or stay the same.
 */
export interface GhostSetContext {
  /** Weight used in kg */
  weightKg: number;
  /** Reps completed (null = unknown) */
  reps: number | null;
  /** Target reps for the set (null = unknown) */
  targetReps?: number | null;
  /** Reps-in-reserve recorded by the user (null = not tracked) */
  rir: number | null;
}

export type SuggestionIntent = "increase" | "maintain";

export interface OverloadSuggestion {
  /** Suggested weight in kg (store-native) */
  weightKg: number;
  /** Whether we're suggesting an increase or maintaining */
  intent: SuggestionIntent;
}

/**
 * Smart progressive overload suggestion that considers previous-set difficulty.
 *
 * Rules:
 * - If RIR >= 2 (comfortable set) and reps were completed: suggest weight increase
 * - If RIR is 0-1 (grinding) or reps were missed: suggest same weight (maintain)
 * - If RIR is null (not tracked): default to suggesting an increase
 * - Muscle group affects increment size (lower body gets bigger jumps)
 */
export function calcSmartSuggestion(
  ghost: GhostSetContext,
  preference: "imperial" | "metric",
  muscleGroup?: string,
): OverloadSuggestion {
  const { weightKg, rir, reps, targetReps } = ghost;

  // Determine if the previous set was "hard" (grinding / failed reps)
  const wasGrinding = rir !== null && rir <= 1;
  const missedReps =
    targetReps != null && reps != null && reps < targetReps;

  // If grinding or missed reps, suggest maintaining the same weight
  if (wasGrinding || missedReps) {
    return { weightKg, intent: "maintain" };
  }

  // Otherwise suggest an increase
  const isLowerBody = muscleGroup != null && LOWER_BODY_GROUPS.has(muscleGroup);

  if (preference === "imperial") {
    const ghostLbs = weightKg * KG_TO_LBS;
    // Lower body: 5-10 lbs, upper body: 2.5-5 lbs
    const bump = isLowerBody
      ? (ghostLbs < 200 ? 5 : 10)
      : (ghostLbs < 100 ? 2.5 : 5);
    const snappedLbs = Math.round((ghostLbs + bump) / 2.5) * 2.5;
    return { weightKg: snappedLbs / KG_TO_LBS, intent: "increase" };
  }

  // Metric: lower body 2.5 kg, upper body 1.25-2.5 kg
  const bump = isLowerBody
    ? (weightKg < 100 ? 2.5 : 5)
    : (weightKg < 50 ? 1.25 : 2.5);
  const suggested = Math.round((weightKg + bump) / 1.25) * 1.25;
  return { weightKg: suggested, intent: "increase" };
}
